import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";

/**
 * Fotos no FleetPulse
 * ────────────────────
 * Antes, toda foto (caminhão, peça, item de checklist, abastecimento) era
 * convertida em base64 e gravada DENTRO do documento no Firestore. Três
 * problemas com isso:
 *
 *   1. O limite de um documento no Firestore é 1 MB. Uma foto de 800 KB em
 *      base64 já ocupa ~1,07 MB — ou seja, a gravação simplesmente falhava.
 *      Num checklist com várias fotos, estourava sempre.
 *   2. base64 é ~33% maior que o arquivo original.
 *   3. Abrir a lista de caminhões baixava TODAS as fotos junto, porque elas
 *      fazem parte dos documentos. Não dá para carregar depois nem em partes.
 *
 * Agora a foto vai para o Firebase Storage e o documento guarda só a URL
 * (algumas centenas de bytes). O navegador baixa a imagem quando ela aparece
 * na tela, e o Storage serve com cache.
 */

/** Reduz e comprime a imagem no navegador antes de subir. */
export function compressToBlob(
  file: File,
  maxWidth = 1280,
  quality = 0.72
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas not supported"));
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Could not compress image"))),
        "image/jpeg",
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not read image"));
    };

    img.src = objectUrl;
  });
}

/**
 * Comprime, envia para o Storage e devolve a URL pública da imagem.
 * `folder` organiza os arquivos: "trucks", "parts", "checklists", "fuel".
 */
export async function uploadImage(
  file: File,
  folder: "trucks" | "parts" | "checklists" | "fuel",
  options: { maxWidth?: number; quality?: number } = {}
): Promise<string> {
  const blob = await compressToBlob(file, options.maxWidth, options.quality);
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.jpg`;
  const fileRef = ref(storage, `${folder}/${name}`);
  await uploadBytes(fileRef, blob, { contentType: "image/jpeg" });
  return getDownloadURL(fileRef);
}

/**
 * Qual imagem mostrar. Registros antigos têm `imageBase64` / `photoUrl` em
 * base64; os novos têm uma URL do Storage. Isto aceita os dois, então nada
 * do que já está gravado se perde.
 */
export function imageSrc(
  ...candidates: (string | null | undefined)[]
): string | undefined {
  for (const value of candidates) {
    if (value && value.trim() !== "") return value;
  }
  return undefined;
}
