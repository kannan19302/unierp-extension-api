import { z } from "zod";

/**
 * Declarative model extensions — PLATFORM_ARCHITECTURE.md § 8.2.
 *
 *   "schema/  declarative model extensions → generated tables in the tenant's
 *    extension namespace, always with tenant_id + RLS, never core tables"
 *
 * Three properties are load-bearing and are enforced here rather than trusted:
 *
 *   1. **Never core tables.** A generated table is always named
 *      `ext_<extension-id>_<entity>`, so an extension cannot name, collide
 *      with, or shadow a first-party table. The prefix is applied by the
 *      generator, not supplied by the manifest.
 *   2. **Always tenant_id + RLS.** Every generated table gets the column, the
 *      policy, and `FORCE`, identically to a first-party table. An extension
 *      table is tenant data and is protected by the same layer that protects
 *      everything else — the database.
 *   3. **No free-form SQL anywhere.** Identifiers come from this schema and are
 *      validated against a strict pattern before they can reach DDL; types come
 *      from a closed set. A manifest cannot express a type or a name that is
 *      not on these lists.
 */

/** Identifier rule for anything that reaches DDL. Deliberately narrow. */
export const IDENTIFIER = /^[a-z][a-z0-9_]{0,48}$/;

export const FIELD_TYPES = [
  "string",
  "text",
  "int",
  "decimal",
  "boolean",
  "datetime",
  "json",
] as const;

export type FieldType = (typeof FIELD_TYPES)[number];

/**
 * Postgres type per declared field type. `decimal` is Decimal(19,4) because an
 * extension storing money must be held to the same rule as the core schema —
 * ARCHITECTURE_REVIEW § F11 exists precisely because that was not enforced.
 */
export const PG_TYPE: Record<FieldType, string> = {
  string: "TEXT",
  text: "TEXT",
  int: "INTEGER",
  decimal: "DECIMAL(19,4)",
  boolean: "BOOLEAN",
  datetime: "TIMESTAMP(3)",
  json: "JSONB",
};

export const ExtensionFieldSchema = z.object({
  name: z.string().regex(IDENTIFIER, "field name must be lower_snake_case"),
  type: z.enum(FIELD_TYPES),
  required: z.boolean().default(false),
  indexed: z.boolean().default(false),
});

export type ExtensionField = z.infer<typeof ExtensionFieldSchema>;

export const ExtensionEntitySchema = z.object({
  name: z.string().regex(IDENTIFIER, "entity name must be lower_snake_case"),
  fields: z.array(ExtensionFieldSchema).min(1).max(64),
});

export type ExtensionEntity = z.infer<typeof ExtensionEntitySchema>;

export const ExtensionSchemaSchema = z.object({
  entities: z.array(ExtensionEntitySchema).max(32).default([]),
});

export type ExtensionSchema = z.infer<typeof ExtensionSchemaSchema>;

/** Reserved names an extension entity may never take. */
const RESERVED = new Set(["id", "tenant_id", "created_at", "updated_at"]);

/**
 * The physical table name for an extension entity.
 *
 * Both parts are re-validated here even though the schema already validated
 * them, because this is the function whose output is interpolated into DDL —
 * the check belongs at the boundary that matters, not only at parse time.
 */
export function extensionTableName(
  extensionId: string,
  entity: string,
): string {
  const id = extensionId.replace(/-/g, "_");
  if (!IDENTIFIER.test(id)) {
    throw new Error(`Unsafe extension id for DDL: ${extensionId}`);
  }
  if (!IDENTIFIER.test(entity)) {
    throw new Error(`Unsafe entity name for DDL: ${entity}`);
  }
  return `ext_${id}_${entity}`;
}

/** Columns an extension declares, rejecting any that collide with the platform's own. */
export function validateFields(entity: ExtensionEntity): ExtensionField[] {
  for (const f of entity.fields) {
    if (RESERVED.has(f.name)) {
      throw new Error(
        `Extension entity "${entity.name}" declares reserved column "${f.name}". ` +
          `id, tenant_id, created_at and updated_at are supplied by the platform.`,
      );
    }
  }
  const seen = new Set<string>();
  for (const f of entity.fields) {
    if (seen.has(f.name)) {
      throw new Error(
        `Extension entity "${entity.name}" declares "${f.name}" twice.`,
      );
    }
    seen.add(f.name);
  }
  return entity.fields;
}
