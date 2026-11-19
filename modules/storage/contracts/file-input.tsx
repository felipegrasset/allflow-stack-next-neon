"use client"

/**
 * El componente de cliente de `storage`:
 *
 *   import { FileInput } from "@/modules/storage/contracts/file-input"
 *   <FileInput name="receiptId" onUploaded={(f) => …} />
 *
 * Sube en cuanto se elige el archivo y deja el id en un input oculto `name`,
 * así el formulario manda solo el id a tu server action.
 */
export { FileInput, type FileInputProps } from "../ui/file-input"
