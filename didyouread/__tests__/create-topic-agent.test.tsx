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

  it("turns photographed pages into one document agent", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ agent: { id: "photo-agent" } }),
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<><CreateAgentObject /><CreateTopicModal /></>);

    fireEvent.click(screen.getByRole("button", { name: "Create a new agent" }));
    const picker = screen.getByLabelText(/upload a pdf or a photo/i, { selector: "input" });
    fireEvent.change(picker, {
      target: {
        files: [
          new File(["a"], "IMG_01.jpg", { type: "image/jpeg" }),
          new File(["b"], "IMG_02.jpg", { type: "image/jpeg" }),
        ],
      },
    });

    // Both photos are listed as pages of the same document before sending.
    expect(await screen.findByText("2 photos ready")).toBeInTheDocument();
    expect(screen.getByText("Page 2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Create agent" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/agents/photo-agent"));
    const body = fetchMock.mock.calls.at(-1)?.[1].body as FormData;
    expect(body.getAll("document")).toHaveLength(2);
  });

  it("refuses a file that is neither a PDF nor a photo", async () => {
    render(<><CreateAgentObject /><CreateTopicModal /></>);

    fireEvent.click(screen.getByRole("button", { name: "Create a new agent" }));
    fireEvent.change(screen.getByLabelText(/upload a pdf or a photo/i, { selector: "input" }), {
      target: { files: [new File(["a"], "notes.txt", { type: "text/plain" })] },
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(/photo of the document/i);
  });
});
