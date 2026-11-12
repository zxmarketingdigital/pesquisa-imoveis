export const LOCALIZACOES: Readonly<Record<string, readonly string[]>> = {
  Lisboa: ['Lumiar', 'Telheiras', 'Carnide', 'Santa Clara', 'Ameixoeira'],
  Odivelas: ['Odivelas', 'Póvoa de Santo Adrião'],
  Loures: ['Moscavide'],
};

export const chaveZona = (concelho: string, zona: string): string => `${concelho}/${zona}`;
