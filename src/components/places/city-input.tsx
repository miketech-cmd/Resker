"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useId } from "react";

import { Input, Label } from "@/components/ui/input";
import { extractFacetOptions } from "@/lib/places/facets";
import { restaurantQueryKeys, type UserRestaurantItem } from "@/lib/queries/restaurants";

export function CityInput({
  id = "restaurant-city-input",
  label = "City",
  value,
  onChange,
  placeholder = "e.g. San Francisco",
}: {
  id?: string;
  label?: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
}) {
  const listId = useId();
  const queryClient = useQueryClient();
  const cachedRestaurants =
    queryClient.getQueryData<UserRestaurantItem[]>(restaurantQueryKeys.all) ?? [];
  const savedCities = extractFacetOptions(cachedRestaurants, "city");

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        list={savedCities.length > 0 ? listId : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {savedCities.length > 0 ? (
        <datalist id={listId}>
          {savedCities.map((city) => (
            <option key={city.key} value={city.label} />
          ))}
        </datalist>
      ) : null}
    </div>
  );
}
