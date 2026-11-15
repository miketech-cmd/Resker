"use client";

import { Plus, X } from "lucide-react";
import { useState, type KeyboardEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { QUICK_CUISINE_SUGGESTIONS } from "@/lib/places/cuisines";

export function CuisineTagEditor({
  id = "cuisine-tag-input",
  value,
  onChange,
  maxTags = 6,
}: {
  id?: string;
  value: string[];
  onChange: (next: string[]) => void;
  maxTags?: number;
}) {
  const [draft, setDraft] = useState("");

  function addTag(rawTag: string) {
    const clean = rawTag.trim();
    if (!clean) return;
    if (value.some((c) => c.toLowerCase() === clean.toLowerCase())) {
      setDraft("");
      return;
    }
    if (value.length >= maxTags) return;
    onChange([...value, clean]);
    setDraft("");
  }

  function removeTag(tag: string) {
    onChange(value.filter((c) => c !== tag));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addTag(draft);
    }
  }

  const availableSuggestions = QUICK_CUISINE_SUGGESTIONS.filter(
    (s) => !value.some((c) => c.toLowerCase() === s.toLowerCase()),
  ).slice(0, 6);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>Cuisines</Label>
        <span className="text-xs text-muted">
          {value.length}/{maxTags}
        </span>
      </div>

      {value.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => removeTag(tag)}
              aria-label={`Remove ${tag}`}
              className="inline-flex min-h-9 cursor-pointer items-center gap-1 rounded-full border border-accent/30 bg-accent/10 px-3 text-sm font-medium text-ink hover:bg-accent/20 focus-visible:outline-2 focus-visible:outline-ring"
            >
              <span>{tag}</span>
              <X className="size-3.5 text-muted" aria-hidden="true" />
            </button>
          ))}
        </div>
      ) : null}

      {value.length < maxTags ? (
        <>
          <div className="flex gap-2">
            <Input
              id={id}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Add cuisine tag (e.g. Ramen)"
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => addTag(draft)}
              disabled={!draft.trim()}
              aria-label="Add cuisine tag"
            >
              <Plus className="size-4" aria-hidden="true" />
            </Button>
          </div>

          {availableSuggestions.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {availableSuggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => addTag(suggestion)}
                  className="inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-full border border-border bg-surface px-2.5 text-xs font-medium text-muted hover:border-ink/30 hover:text-ink focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <Plus className="size-3" aria-hidden="true" />
                  {suggestion}
                </button>
              ))}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
