import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Modal, SearchField } from "./ui";
describe("accessible shared controls", () => {
  it("labels search inputs and reports edits", () => {
    const change = vi.fn();
    render(
      <SearchField value="" onChange={change} placeholder="Search studies" />,
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Search studies" }), {
      target: { value: "SYN-42" },
    });
    expect(change).toHaveBeenCalledWith("SYN-42");
  });
  it("exposes dialog title and close action", () => {
    const close = vi.fn();
    render(
      <Modal open onClose={close} title="Review recovery">
        <p>Evidence required</p>
      </Modal>,
    );
    expect(
      screen.getByRole("dialog", { name: "Review recovery" }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
    expect(close).toHaveBeenCalled();
  });
});
