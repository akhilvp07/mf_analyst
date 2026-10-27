import { describe, it, expect } from 'vitest';
import { runFifoLotEngine } from '../src/utils/fifoLotEngine';
import { TransactionRecord } from '../src/types';

describe('FIFO Lot-Matching Engine', () => {
  it('correctly allocates unrealised lots when no redemptions occurred', () => {
    const txs: TransactionRecord[] = [
      {
        id: 'tx-1',
        folioNumber: 'FOLIO-101',
        schemeCode: '122639',
        schemeName: 'Parag Parikh Flexi Cap Fund',
        type: 'SIP',
        date: '2023-01-10',
        units: 100,
        nav: 50,
        amount: 5000,
        status: 'COMPLETED'
      },
      {
        id: 'tx-2',
        folioNumber: 'FOLIO-101',
        schemeCode: '122639',
        schemeName: 'Parag Parikh Flexi Cap Fund',
        type: 'SIP',
        date: '2023-02-10',
        units: 100,
        nav: 55,
        amount: 5500,
        status: 'COMPLETED'
      }
    ];

    const currentNavs = { '122639': 80 };
    const result = runFifoLotEngine(txs, currentNavs, new Date('2024-03-01'));

    expect(result.realizedRows.length).toBe(0);
    expect(result.unrealizedRows.length).toBe(2);
    expect(result.unrealizedSummary.totalUnrealizedGain).toBe(200 * 80 - (5000 + 5500));
  });

  it('consumes earlier purchase lots first upon partial redemption (Strict FIFO)', () => {
    const txs: TransactionRecord[] = [
      {
        id: 'tx-1',
        folioNumber: 'FOLIO-101',
        schemeCode: '122639',
        schemeName: 'Parag Parikh Flexi Cap Fund',
        type: 'SIP',
        date: '2023-01-10',
        units: 100,
        nav: 50,
        amount: 5000,
        status: 'COMPLETED'
      },
      {
        id: 'tx-2',
        folioNumber: 'FOLIO-101',
        schemeCode: '122639',
        schemeName: 'Parag Parikh Flexi Cap Fund',
        type: 'SIP',
        date: '2023-06-10',
        units: 100,
        nav: 60,
        amount: 6000,
        status: 'COMPLETED'
      },
      {
        id: 'tx-3',
        folioNumber: 'FOLIO-101',
        schemeCode: '122639',
        schemeName: 'Parag Parikh Flexi Cap Fund',
        type: 'REDEMPTION',
        date: '2023-09-15',
        units: 150, // Consumes all 100 of tx-1 and 50 of tx-2
        nav: 70,
        amount: 10500,
        status: 'COMPLETED'
      }
    ];

    const currentNavs = { '122639': 85 };
    const result = runFifoLotEngine(txs, currentNavs, new Date('2024-01-01'));

    // Should output 2 realised rows: 100 from lot 1, 50 from lot 2
    expect(result.realizedRows.length).toBe(2);
    expect(result.realizedRows[0].units).toBe(100);
    expect(result.realizedRows[0].buyNav).toBe(50);
    expect(result.realizedRows[0].saleNav).toBe(70);
    expect(result.realizedRows[0].gainOrLoss).toBe(100 * (70 - 50)); // 2000

    expect(result.realizedRows[1].units).toBe(50);
    expect(result.realizedRows[1].buyNav).toBe(60);
    expect(result.realizedRows[1].saleNav).toBe(70);
    expect(result.realizedRows[1].gainOrLoss).toBe(50 * (70 - 60)); // 500

    // Remaining unrealised lot should be exactly 50 units from tx-2
    expect(result.unrealizedRows.length).toBe(1);
    expect(result.unrealizedRows[0].units).toBe(50);
    expect(result.unrealizedRows[0].buyNav).toBe(60);
    expect(result.unrealizedRows[0].currentNav).toBe(85);
  });

  it('handles SWITCH_OUT and SWITCH_IN correctly', () => {
    const txs: TransactionRecord[] = [
      {
        id: 'tx-1',
        folioNumber: 'FOLIO-101',
        schemeCode: '1001',
        schemeName: 'Fund A',
        type: 'LUMPSUM',
        date: '2023-01-01',
        units: 100,
        nav: 10,
        amount: 1000,
        status: 'COMPLETED'
      },
      {
        id: 'tx-2',
        folioNumber: 'FOLIO-101',
        schemeCode: '1001',
        schemeName: 'Fund A',
        type: 'SWITCH_OUT',
        date: '2023-07-01',
        units: 100,
        nav: 15,
        amount: 1500,
        status: 'COMPLETED'
      },
      {
        id: 'tx-3',
        folioNumber: 'FOLIO-101',
        schemeCode: '1002',
        schemeName: 'Fund B',
        type: 'SWITCH_IN',
        date: '2023-07-01',
        units: 150,
        nav: 10,
        amount: 1500,
        status: 'COMPLETED'
      }
    ];

    const currentNavs = { '1001': 16, '1002': 12 };
    const result = runFifoLotEngine(txs, currentNavs, new Date('2024-01-01'));

    expect(result.realizedRows.length).toBe(1);
    expect(result.realizedRows[0].schemeCode).toBe('1001');
    expect(result.realizedRows[0].gainOrLoss).toBe(500);

    expect(result.unrealizedRows.length).toBe(1);
    expect(result.unrealizedRows[0].schemeCode).toBe('1002');
    expect(result.unrealizedRows[0].units).toBe(150);
  });
});
