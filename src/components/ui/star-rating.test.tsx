import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { StarRating } from "./star-rating";

describe("StarRating", () => {
  it("announces half-star values for screen readers and supports keyboard stepping", () => {
    const onChange = vi.fn();
    render(<StarRating value={7} onChange={onChange} label="Overall rating" />);

    const slider = screen.getByRole("slider", { name: "Overall rating: 3.5 of 5 stars" });
    expect(slider).toHaveAttribute("aria-valuenow", "3.5");

    fireEvent.keyDown(slider, { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith(8);

    fireEvent.keyDown(slider, { key: "ArrowLeft" });
    expect(onChange).toHaveBeenCalledWith(6);
  });

  it("renders read-only rating cleanly", () => {
    render(<StarRating value={9} readOnly label="Visit rating" />);
    expect(screen.getByRole("img", { name: "Visit rating: 4.5 of 5 stars" })).toBeInTheDocument();
  });
});
