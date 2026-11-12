import { supabase } from './cliente';

const LADO_MAXIMO = 1200;
const TAMANHO_MAXIMO = 5 * 1024 * 1024; // igual ao file_size_limit do bucket
const CAMINHO_FOTO = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$/;

export async function comprimirParaJpeg(ficheiro: Blob): Promise<Blob> {
  if (!ficheiro.type.startsWith('image/')) throw new Error('O ficheiro não é uma imagem');
  if (ficheiro.size > TAMANHO_MAXIMO) throw new Error('A imagem tem mais de 5 MB');
  const imagem = await createImageBitmap(ficheiro);
  const escala = Math.min(1, LADO_MAXIMO / Math.max(imagem.width, imagem.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(imagem.width * escala);
  canvas.height = Math.round(imagem.height * escala);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('O navegador não conseguiu processar a imagem');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(imagem, 0, 0, canvas.width, canvas.height);
  imagem.close();
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Falha ao comprimir a imagem'))), 'image/jpeg', 0.82);
  });
}

/** Envia a foto e devolve o CAMINHO no bucket (<uuid>.jpg), que é o que a RPC guarda. */
export async function enviarFoto(ficheiro: Blob): Promise<string> {
  const jpeg = await comprimirParaJpeg(ficheiro);
  if (jpeg.size > TAMANHO_MAXIMO) throw new Error('A imagem comprimida continua acima de 5 MB');
  const caminho = `${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from('fotos').upload(caminho, jpeg, { contentType: 'image/jpeg', upsert: false });
  if (error) throw new Error(`Enviar foto: ${error.message}`);
  return caminho;
}

/** URL público de uma foto guardada; nulo se o caminho não for do formato esperado. */
export function urlDaFoto(caminho: string | null): string | null {
  if (!caminho || !CAMINHO_FOTO.test(caminho)) return null;
  return supabase.storage.from('fotos').getPublicUrl(caminho).data.publicUrl;
}

export async function obterFoto(url: string): Promise<ArrayBuffer> {
  const resposta = await fetch(url);
  if (!resposta.ok) throw new Error(`Foto indisponível: HTTP ${resposta.status}`);
  return resposta.arrayBuffer();
}
