import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CreateAgentObject } from "@/components/agent-garden/CreateAgentObject";
import { CreateTopicModal } from "@/components/agents/CreateTopicModal";

const push = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

describe("topic agent creation", () => {
  beforeEach(() => {
    push.mockReset();
    refresh.mockReset();
    vi.restoreAllMocks();
  });

  it("collects a topic and opens the created agent chat", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ agent: { id: "car-agent" } }),
    }));
    render(<><CreateAgentObject /><CreateTopicModal /></>);

    fireEvent.click(screen.getByRole("button", { name: "Create a new agent" }));
    fireEvent.change(screen.getByLabelText("Agent topic"), { target: { value: "Car agreement" } });
    fireEvent.click(screen.getByRole("button", { name: "Create agent" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/agents/car-agent"));
    expect(fetch).toHaveBeenCalledWith("/api/agents/topic", expect.objectContaining({ method: "POST" }));
  });
});
