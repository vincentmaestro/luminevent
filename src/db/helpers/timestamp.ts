import { timestamp } from "drizzle-orm/pg-core";

export const timestamps = {
  createdAt: timestamp('created_at')
    .$defaultFn(() => new Date())
    .notNull(),
  
  updatedAt: timestamp('updated_at')
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()) 
    .notNull(),
}