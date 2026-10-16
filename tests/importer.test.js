import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv } from '../server/importer.js';

describe('Importador CSV - parseCsv', () => {
  it('parsea un CSV básico separado por comas', () => {
    const csv = 'codigo,nombre,capacidad\nESP-01,Sala A,20\nESP-02,Sala B,15';
    const resultado = parseCsv(csv);

    assert.equal(resultado.length, 2);
    assert.deepEqual(resultado[0], {
      codigo: 'ESP-01',
      nombre: 'Sala A',
      capacidad: '20',
    });
    assert.deepEqual(resultado[1], {
      codigo: 'ESP-02',
      nombre: 'Sala B',
      capacidad: '15',
    });
  });

  describe('Soporte de delimitadores: punto y coma', () => {
    it('parsea correctamente archivos delimitados por punto y coma (;)', () => {
      const csv = 'codigo;nombre;capacidad\nESP-01;Sala A;30\nESP-02;Sala B;25';
      const resultado = parseCsv(csv);

      assert.equal(resultado.length, 2);
      assert.deepEqual(resultado[0], {
        codigo: 'ESP-01',
        nombre: 'Sala A',
        capacidad: '30',
      });
      assert.deepEqual(resultado[1], {
        codigo: 'ESP-02',
        nombre: 'Sala B',
        capacidad: '25',
      });
    });
  });

  describe('Soporte de comillas y caracteres especiales', () => {
    it('maneja campos entrecomillados que contienen comas y punto y coma', () => {
      const csv = 'codigo,nombre,descripcion\nESP-01,"Sala A, Principal",Edificio 1\nESP-02,"Sala B; Anexo",Edificio 2';
      const resultado = parseCsv(csv);

      assert.equal(resultado.length, 2);
      assert.equal(resultado[0].codigo, 'ESP-01');
      assert.equal(resultado[0].nombre, 'Sala A, Principal');
      assert.equal(resultado[0].descripcion, 'Edificio 1');

      assert.equal(resultado[1].codigo, 'ESP-02');
      assert.equal(resultado[1].nombre, 'Sala B; Anexo');
      assert.equal(resultado[1].descripcion, 'Edificio 2');
    });

    it('maneja comillas dobles escapadas dentro de campos entrecomillados ("")', () => {
      const csv = 'codigo,nombre\nEQ-01,"Laptop ""Gamer"" Pro"\nEQ-02,"Monitor ""UltraWide"""';
      const resultado = parseCsv(csv);

      assert.equal(resultado.length, 2);
      assert.equal(resultado[0].codigo, 'EQ-01');
      assert.equal(resultado[0].nombre, 'Laptop "Gamer" Pro');
      assert.equal(resultado[1].codigo, 'EQ-02');
      assert.equal(resultado[1].nombre, 'Monitor "UltraWide"');
    });

    it('maneja saltos de línea dentro de campos entrecomillados', () => {
      const csv = 'codigo,descripcion\nESP-01,"Piso 1\nLado norte"\nESP-02,"Piso 2"';
      const resultado = parseCsv(csv);

      assert.equal(resultado.length, 2);
      assert.equal(resultado[0].codigo, 'ESP-01');
      assert.equal(resultado[0].descripcion, 'Piso 1\nLado norte');
      assert.equal(resultado[1].codigo, 'ESP-02');
      assert.equal(resultado[1].descripcion, 'Piso 2');
    });
  });

  describe('Soporte de Byte Order Mark (BOM)', () => {
    it('elimina el BOM UTF-8 (\\uFEFF) al inicio del texto sin alterar el primer encabezado', () => {
      const csvConBom = '\uFEFFcodigo,nombre,tipo\nESP-01,Auditorio,auditorio';
      const resultado = parseCsv(csvConBom);

      assert.equal(resultado.length, 1);
      assert.ok('codigo' in resultado[0], 'El encabezado "codigo" no debe contener el caracter BOM');
      assert.equal(resultado[0].codigo, 'ESP-01');
      assert.equal(resultado[0].nombre, 'Auditorio');
      assert.equal(resultado[0].tipo, 'auditorio');
    });
  });

  describe('Manejo de filas vacías y saltos de línea redundantes', () => {
    it('ignora líneas vacías intermedias y saltos de línea repetidos', () => {
      const csv = 'codigo,nombre\n\nESP-01,Sala A\r\n\r\n\nESP-02,Sala B\n\n';
      const resultado = parseCsv(csv);

      assert.equal(resultado.length, 2);
      assert.equal(resultado[0].codigo, 'ESP-01');
      assert.equal(resultado[1].codigo, 'ESP-02');
    });

    it('ignora filas compuestas únicamente por espacios en blanco', () => {
      const csv = 'codigo,nombre\n   \nESP-01,Sala A\n   \t  \nESP-02,Sala B';
      const resultado = parseCsv(csv);

      assert.equal(resultado.length, 2);
      assert.equal(resultado[0].codigo, 'ESP-01');
      assert.equal(resultado[1].codigo, 'ESP-02');
    });

    it('devuelve un arreglo vacío si el contenido está completamente vacío o solo contiene espacios', () => {
      assert.deepEqual(parseCsv(''), []);
      assert.deepEqual(parseCsv('   \n\r\n  \t '), []);
    });

    it('devuelve un arreglo vacío si solo contiene encabezados sin filas de datos', () => {
      const csv = 'codigo,nombre,capacidad\n';
      const resultado = parseCsv(csv);
      assert.deepEqual(resultado, []);
    });
  });

  describe('Normalización de encabezados y limpieza de valores', () => {
    it('normaliza encabezados quitando tildes, pasando a minúsculas y sustituyendo espacios por guiones bajos', () => {
      const csv = 'Código del Espacio , Categoría Principal , Ubicación Física\nESP-1,Hardware,Edificio A';
      const resultado = parseCsv(csv);

      assert.equal(resultado.length, 1);
      assert.deepEqual(resultado[0], {
        codigo_del_espacio: 'ESP-1',
        categoria_principal: 'Hardware',
        ubicacion_fisica: 'Edificio A',
      });
    });

    it('aplica trim a los valores de cada celda', () => {
      const csv = 'codigo,nombre\n  ESP-99  ,   Laboratorio Central   ';
      const resultado = parseCsv(csv);

      assert.equal(resultado.length, 1);
      assert.equal(resultado[0].codigo, 'ESP-99');
      assert.equal(resultado[0].nombre, 'Laboratorio Central');
    });
  });
});
