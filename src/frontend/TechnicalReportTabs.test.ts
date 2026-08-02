import test from 'node:test'
import assert from 'node:assert/strict'
import { buildDiagnosticContext } from './TechnicalReportTabs.js'

test('buildDiagnosticContext assembles the main diagnostic fields', () => {
  const report = {
    diagnostico: {
      clientReport: 'Cliente relatou falha ao ligar.',
      testsExecuted: 'Teste de alimentação e inspeção visual.',
      powerStageStatus: 'Fonte com oscilação.',
      usageTimeEstimate: '12 meses',
    },
    cliente: {
      name: 'Ana Souza',
      phone: '11999999999',
    },
    equipamento: {
      type: 'Notebook',
      brand: 'Dell',
      model: 'Inspiron 15',
      serialNumber: 'ABC123',
      warranty: 'Garantia vencida',
      accessories: 'Carregador, mouse',
      lineFilter: 'Filtro de linha instalado',
      ups: 'Nobreak presente',
      dps: 'DPS instalado',
      grounding: 'Aterramento correto',
    },
    componentes: [
      { description: 'Fonte', function: 'Alimentação', observations: 'Queimou' },
      { description: 'Placa', function: 'Processamento', observations: 'Sem defeito' },
    ],
    assistencia: {
      technicianName: 'João',
    },
  }

  const context = buildDiagnosticContext(report as any)

  assert.equal(context?.relatoCliente, 'Cliente relatou falha ao ligar.')
  assert.equal(context?.testesExecutados, 'Teste de alimentação e inspeção visual.')
  assert.match(context?.componentesAvariados ?? '', /Fonte/)
  assert.match(context?.contextoEquipamento ?? '', /Notebook/)
  assert.match(context?.protecaoEletrica ?? '', /Filtro de linha instalado/)
})
