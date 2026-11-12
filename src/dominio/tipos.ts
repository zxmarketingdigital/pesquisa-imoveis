export type Portal = 'Imovirtual' | 'Casa Sapo' | 'CasaYes' | 'Outro';
export type Canal = 'whatsapp' | 'email';
export type CampoEmFalta = 'ano' | 'garagem';

export interface Anuncio { portal: Portal; url: string }

export interface Imovel {
  id: string;
  referencia: string | null;
  imobiliaria: string;
  tipologia: string;
  preco: number;
  areaM2: number | null;
  concelho: string;
  zona: string;
  anoConstrucao: number | null;
  construcaoNova: boolean | null;
  garagem: boolean | null;
  consultorNome: string | null;
  telefone: string | null;
  email: string | null;
  fotoUrl: string | null;
  primeiraVez: string;
  anuncios: Anuncio[];
}

export interface Pesquisa {
  id: string;
  compradorId: string;
  tipologia: string;
  precoMax: number;
  zonas: string[];
  garagemObrigatoria: boolean;
  menosDeAnos: number | null;
  ultimaAtualizacao: string;
  novosDesde: string | null;
}

export interface Comprador { id: string; nome: string; contacto: string | null; pesquisa: Pesquisa }

export interface Contacto { id: string; imovelId: string; canal: Canal; criadoEm: string }

export type Avaliacao = { entra: false } | { entra: true; aConfirmar: CampoEmFalta[] };
