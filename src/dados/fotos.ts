import { supabase } from './cliente';

const LADO_MAXIMO = 1200;

export async function comprimirParaJpeg(ficheiro: Blob): Promise<Blob> {
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

export async function enviarFoto(ficheiro: Blob): Promise<string> {
  const jpeg = await comprimirParaJpeg(ficheiro);
  const caminho = `${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from('fotos').upload(caminho, jpeg, { contentType: 'image/jpeg', upsert: false });
  if (error) throw new Error(`Enviar foto: ${error.message}`);
  return supabase.storage.from('fotos').getPublicUrl(caminho).data.publicUrl;
}

export async function obterFoto(url: string): Promise<ArrayBuffer> {
  const resposta = await fetch(url);
  if (!resposta.ok) throw new Error(`Foto indisponível: HTTP ${resposta.status}`);
  return resposta.arrayBuffer();
}
