/**
 * Example definitions: the starter shown in the create form and the two
 * forms the seed saves. Every text comes from the catalog (`messages.ts`) in
 * both languages, so a definition is `{ es, en }` like any real one.
 */
import type { FormDefinitionInput } from "./contracts/definition"
import { en, es } from "./messages"

type Bundle = typeof es.forms

const both = <T extends string>(pick: (b: Bundle) => T) => ({
  es: pick(es.forms) as string,
  en: pick(en.forms as unknown as Bundle) as string,
})

export function starterDefinition(): FormDefinitionInput {
  return {
    title: both((b) => b.starter.title),
    fields: [
      { id: "name", type: "text", label: both((b) => b.starter.name), required: true },
      {
        id: "rating",
        type: "scale",
        label: both((b) => b.starter.rating),
        required: true,
        from: 1,
        to: 5,
        lowLabel: both((b) => b.starter.low),
        highLabel: both((b) => b.starter.high),
      },
      { id: "comment", type: "textarea", label: both((b) => b.starter.comment) },
    ],
  }
}

export function starterJson(): string {
  return JSON.stringify(starterDefinition(), null, 2)
}

export function satisfactionDefinition(): FormDefinitionInput {
  return {
    title: both((b) => b.seed.satisfaction.title),
    description: both((b) => b.seed.satisfaction.description),
    thanks: both((b) => b.seed.satisfaction.thanks),
    fields: [
      {
        id: "rating",
        type: "scale",
        label: both((b) => b.seed.satisfaction.rating),
        required: true,
        from: 1,
        to: 5,
        lowLabel: both((b) => b.seed.satisfaction.low),
        highLabel: both((b) => b.seed.satisfaction.high),
      },
      {
        id: "channel",
        type: "single",
        label: both((b) => b.seed.satisfaction.channel),
        required: true,
        options: [
          { value: "web", label: both((b) => b.seed.satisfaction.web) },
          { value: "whatsapp", label: both((b) => b.seed.satisfaction.whatsapp) },
          { value: "phone", label: both((b) => b.seed.satisfaction.phone) },
        ],
      },
      {
        id: "improve",
        type: "multiple",
        label: both((b) => b.seed.satisfaction.improve),
        options: [
          { value: "speed", label: both((b) => b.seed.satisfaction.speed) },
          { value: "clarity", label: both((b) => b.seed.satisfaction.clarity) },
          { value: "price", label: both((b) => b.seed.satisfaction.price) },
        ],
      },
      { id: "comment", type: "textarea", label: both((b) => b.seed.satisfaction.comment) },
      { id: "email", type: "email", label: both((b) => b.seed.satisfaction.email) },
    ],
  }
}

export function workshopDefinition(): FormDefinitionInput {
  return {
    title: both((b) => b.seed.workshop.title),
    description: both((b) => b.seed.workshop.description),
    thanks: both((b) => b.seed.workshop.thanks),
    fields: [
      { id: "name", type: "text", label: both((b) => b.seed.workshop.name), required: true },
      { id: "email", type: "email", label: both((b) => b.seed.workshop.email), required: true },
      { id: "date", type: "date", label: both((b) => b.seed.workshop.date) },
      { id: "people", type: "number", label: both((b) => b.seed.workshop.people), required: true, min: 1, max: 16, integer: true },
      { id: "consent", type: "consent", label: both((b) => b.seed.workshop.consent), required: true },
    ],
  }
}
