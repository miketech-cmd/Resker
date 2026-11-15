import { z } from "zod";

import { FOOD_ICON_KEYS } from "@/components/icons/food-icons";

export const listIconSchema = z.enum(FOOD_ICON_KEYS);

export const createListSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "List name is required.")
    .max(80, "List name must be 80 characters or fewer."),
  description: z
    .string()
    .trim()
    .max(300, "Description must be 300 characters or fewer.")
    .nullable()
    .optional(),
  icon: listIconSchema.nullable().optional(),
});

export const updateListSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "List name is required.")
      .max(80, "List name must be 80 characters or fewer.")
      .optional(),
    description: z
      .string()
      .trim()
      .max(300, "Description must be 300 characters or fewer.")
      .nullable()
      .optional(),
    icon: listIconSchema.nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide at least one list field to update.",
  });

export const listItemActionSchema = z.object({
  userRestaurantId: z.string().uuid("Invalid restaurant identifier."),
});

export const reorderListItemSchema = z.object({
  userRestaurantId: z.string().uuid("Invalid restaurant identifier."),
  afterItemId: z.string().uuid().nullable().optional(),
  beforeItemId: z.string().uuid().nullable().optional(),
  position: z
    .string()
    .regex(/^[0-9A-Za-z]{1,64}$/, "Invalid position key.")
    .optional(),
});

export type CreateListInput = z.infer<typeof createListSchema>;
export type UpdateListInput = z.infer<typeof updateListSchema>;
export type ListItemActionInput = z.infer<typeof listItemActionSchema>;
export type ReorderListItemInput = z.infer<typeof reorderListItemSchema>;
