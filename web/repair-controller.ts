import type { ProposalView, RepairArtifact, RepairSession } from "../src/repair-web-contract.ts";
import { errorMessage } from "./api.ts";
import { element } from "./dom.ts";
import { repairApi } from "./repair-api.ts";
import { renderRepair } from "./repair-render.ts";
import type { RepairState } from "./repair-state.ts";

export class RepairController {
  private active = false;
  private revision = 0;
  private session: RepairSession | null = null;
  private availabilityError: string | null = null;
  private state: RepairState = { phase: "idle" };
  private readonly container: HTMLElement;
  constructor(container: HTMLElement) {
    this.container = container;
    this.render();
    void this.loadAvailability();
  }

  private async loadAvailability() {
    this.availabilityError = null;
    this.render();
    try {
      this.session = await repairApi.session();
    } catch (error) {
      this.availabilityError = await errorMessage(error);
    }
    this.render();
  }

  setActive(active: boolean): void {
    if (this.active === active) return;
    this.active = active;
    this.revision += 1;
    this.state = { phase: "idle" };
    this.render();
  }

  private async propose(mode: "reference" | "nebius", consent: boolean) {
    const session = this.session;
    if (
      !this.active ||
      this.state.phase !== "idle" ||
      session === null ||
      session.token === null ||
      !session.enabled
    )
      return;
    if (mode === "nebius" && (!session.liveAvailable || !consent)) return;
    const revision = this.revision;
    this.state = { phase: "proposing" };
    this.render();
    try {
      const request =
        mode === "reference" ? ({ mode } as const) : ({ mode, consentToSendSource: true } as const);
      const proposal = await repairApi.propose(request, session.token);
      if (revision !== this.revision) return;
      this.state = { phase: "review", proposal };
      this.render();
    } catch (error) {
      if (revision === this.revision) {
        this.state = { phase: "error", message: await errorMessage(error) };
        this.render();
      }
    }
  }

  private async verify(proposal: ProposalView) {
    const session = this.session;
    if (
      !this.active ||
      this.state.phase !== "review" ||
      this.state.proposal.jobId !== proposal.jobId ||
      session === null ||
      session.token === null ||
      !session.enabled
    )
      return;
    const revision = this.revision;
    this.state = { phase: "verifying", proposal };
    this.render();
    try {
      const result = await repairApi.verify(
        { jobId: proposal.jobId, proposalHash: proposal.proposalHash, approved: true },
        session.token,
      );
      if (revision !== this.revision) return;
      this.state = { phase: "result", proposal, result };
      this.render();
    } catch (error) {
      if (revision === this.revision) {
        this.state = { phase: "error", message: await errorMessage(error) };
        this.render();
      }
    }
  }

  private async download(proposal: ProposalView, name: RepairArtifact) {
    const token = this.session?.token;
    const revision = this.revision;
    if (!token || !this.active) return;
    try {
      const blob = await repairApi.artifact(proposal.jobId, name, token);
      if (revision !== this.revision) return;
      const url = URL.createObjectURL(blob);
      const link = element("a");
      link.href = url;
      link.download = name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (error) {
      if (revision === this.revision) {
        this.state = { phase: "error", message: await errorMessage(error) };
        this.render();
      }
    }
  }

  private render(): void {
    this.container.replaceChildren(
      renderRepair(
        this.state,
        { active: this.active, session: this.session, availabilityError: this.availabilityError },
        {
          propose: (mode, consent) => void this.propose(mode, consent),
          verify: (proposal) => void this.verify(proposal),
          download: (proposal, name) => void this.download(proposal, name),
          reset: () => {
            this.revision += 1;
            this.state = { phase: "idle" };
            this.render();
          },
          reloadAvailability: () => void this.loadAvailability(),
        },
      ),
    );
  }
}
