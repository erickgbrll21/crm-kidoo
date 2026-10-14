import { describe, expect, it } from 'vitest';
import { cnpj, hoursLabel, money, phone } from './format';

describe('formatadores', () => {
  it('formata dinheiro e telefone BR', () => {
    expect(money(6500)).toMatch(/6\.500/);
    expect(phone('5531999999999')).toBe('(31) 99999-9999');
    expect(cnpj('12345678000190')).toBe('12.345.678/0001-90');
  });
  it('rotula horas do termômetro', () => {
    expect(hoursLabel(0.4)).toBe('há menos de 1h');
    expect(hoursLabel(30)).toBe('há 30h');
    expect(hoursLabel(50)).toBe('há 2 dias');
  });
});
