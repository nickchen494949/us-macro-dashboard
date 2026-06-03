const fs = require('fs');
const path = require('path');

const cacheDir = path.join(__dirname, '../cache/fred');
if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir, { recursive: true });
}

// Generate dates from 2015-01-01 to 2026-05-30
function generateDates(frequency) {
  const dates = [];
  const start = new Date('2015-01-01');
  const end = new Date('2026-05-30');
  let current = new Date(start);

  while (current <= end) {
    dates.push(current.toISOString().split('T')[0]);
    if (frequency === 'daily') {
      current.setDate(current.getDate() + 1);
    } else if (frequency === 'weekly') {
      current.setDate(current.getDate() + 7);
    } else if (frequency === 'monthly') {
      current.setMonth(current.getMonth() + 1);
    }
  }
  return dates;
}

const mockConfigs = {
  DGS2: {
    frequency: 'daily',
    getValue: (date, index, total) => {
      const year = new Date(date).getFullYear();
      const progress = index / total;
      // Start around 0.7%, rise in 2018 (2.8%), drop to 0.1% in 2020, rise to 5.2% in 2023, settle around 4.5% in 2026
      if (year < 2017) return 0.7 + progress * 0.5 + Math.sin(index / 30) * 0.1;
      if (year < 2019) return 1.2 + (year - 2017) * 0.8 + Math.sin(index / 50) * 0.2;
      if (year < 2021) return 2.8 - (year - 2018.5) * 2.5 + Math.sin(index / 40) * 0.15;
      if (year < 2024) return 0.15 + (index - total * 0.5) / (total * 0.3) * 5.0 + Math.sin(index / 60) * 0.3;
      return 4.8 - (index - total * 0.8) / (total * 0.2) * 0.5 + Math.sin(index / 100) * 0.15;
    }
  },
  DGS10: {
    frequency: 'daily',
    getValue: (date, index, total) => {
      const year = new Date(date).getFullYear();
      const progress = index / total;
      // Start around 2.0%, peak 3.2% in 2018, drop to 0.6% in 2020, rise to 4.8% in 2023, settle around 4.2% in 2026
      if (year < 2017) return 2.0 + progress * 0.4 + Math.sin(index / 30) * 0.1;
      if (year < 2019) return 2.3 + Math.sin(index / 50) * 0.3;
      if (year < 2021) return 3.0 - (year - 2018) * 1.2 + Math.sin(index / 40) * 0.2;
      if (year < 2024) return 0.7 + (index - total * 0.5) / (total * 0.3) * 4.0 + Math.sin(index / 60) * 0.25;
      return 4.4 - (index - total * 0.8) / (total * 0.2) * 0.3 + Math.sin(index / 100) * 0.1;
    }
  },
  T10Y2Y: {
    frequency: 'daily',
    getValue: (date, index, total) => {
      // 10Y minus 2Y. Inverted since 2022.
      const d10 = mockConfigs.DGS10.getValue(date, index, total);
      const d2 = mockConfigs.DGS2.getValue(date, index, total);
      return d10 - d2;
    }
  },
  WALCL: {
    frequency: 'weekly',
    getValue: (date, index, total) => {
      const d = new Date(date);
      // Fed total assets in millions. Starts at 4.5M, jumps to 7M in 2020, peaks 9M in 2022, QT down to 7.3M in 2026
      if (d < new Date('2020-03-01')) {
        return 4500000 - (index * 1500) + Math.sin(index) * 20000;
      }
      if (d < new Date('2022-04-01')) {
        const tIndex = index - (total * 5 / 11);
        return 4200000 + (tIndex * 22000) + Math.cos(index) * 30000;
      }
      const qIndex = index - (total * 7.5 / 11);
      return 8900000 - (qIndex * 11000) + Math.sin(index / 2) * 15000;
    }
  },
  RRPONTSYD: {
    frequency: 'daily',
    getValue: (date, index, total) => {
      const d = new Date(date);
      // Reverse repo in millions. Near zero before 2021. Peaks 2.4M in late 2022/2023. QT drains it down to 400k in 2026.
      if (d < new Date('2021-03-01')) {
        return Math.max(0, 5000 + Math.sin(index) * 4000);
      }
      if (d < new Date('2023-01-01')) {
        const progress = (d - new Date('2021-03-01')) / (new Date('2023-01-01') - new Date('2021-03-01'));
        return progress * 2300000 + Math.sin(index / 5) * 50000;
      }
      const progress = (d - new Date('2023-01-01')) / (new Date('2026-05-30') - new Date('2023-01-01'));
      return 2300000 - progress * 1900000 + Math.sin(index / 10) * 30000;
    }
  },
  WDTGAL: {
    frequency: 'weekly',
    getValue: (date, index, total) => {
      // Treasury General Account in millions. Fluctuate between 100k and 1.6M.
      const d = new Date(date);
      if (d.getFullYear() === 2020) return 1200000 + Math.sin(index) * 300000;
      if (d.getFullYear() === 2023 && d.getMonth() < 6) return 80000 - (d.getMonth() * 12000) + Math.random() * 20000; // Debt ceiling drain
      return 600000 + Math.sin(index / 3) * 400000 + Math.cos(index) * 80000;
    }
  },
  M2SL: {
    frequency: 'monthly',
    getValue: (date, index, total) => {
      const d = new Date(date);
      // M2 in billions. 11600 in 2015, rises to 21700 in 2022, down to 20800 in 2026.
      if (d < new Date('2020-03-01')) {
        return 11600 + index * 70;
      }
      if (d < new Date('2022-04-01')) {
        const tIndex = index - 62;
        return 15500 + tIndex * 240;
      }
      const qIndex = index - 87;
      return 21700 - qIndex * 18 + Math.sin(index) * 30;
    }
  },
  TOTBKCR: {
    frequency: 'weekly',
    getValue: (date, index, total) => {
      // Commercial Bank Credit in billions. Steady growth from 10800 to 17600.
      return 10800 + (index / total) * 6800 + Math.sin(index / 10) * 80;
    }
  },
  BAMLH0A0HYM2: {
    frequency: 'daily',
    getValue: (date, index, total) => {
      const d = new Date(date);
      // High Yield spread in %. Normal 3.5-5.0. 2016 energy bust: 8.5%. 2020 COVID: 10.8%. 2026: 3.8%.
      if (d.getFullYear() === 2016 && d.getMonth() < 3) return 7.5 + Math.sin(index) * 0.8;
      if (d.getFullYear() === 2020 && d.getMonth() >= 2 && d.getMonth() <= 5) return 8.5 + Math.cos(index / 3) * 2.0;
      if (d.getFullYear() === 2022) return 4.8 + Math.sin(index / 10) * 0.6;
      return 3.8 + Math.sin(index / 20) * 0.5 + Math.cos(index / 7) * 0.2;
    }
  },
  BAMLC0A0CM: {
    frequency: 'daily',
    getValue: (date, index, total) => {
      // IG spread. Roughly 1/3 of HY spread.
      const hy = mockConfigs.BAMLH0A0HYM2.getValue(date, index, total);
      return Math.max(0.7, parseFloat((hy * 0.28 + 0.1 + Math.sin(index / 15) * 0.05).toFixed(2)));
    }
  },
  STLFSI4: {
    frequency: 'weekly',
    getValue: (date, index, total) => {
      const d = new Date(date);
      // Stress index. Normal -1.0 to -0.5. Spikes in 2020 to 5.5, 2023 bank crisis to 1.5.
      if (d.getFullYear() === 2020 && d.getMonth() >= 2 && d.getMonth() <= 4) return 4.0 + Math.sin(index) * 1.5;
      if (d.getFullYear() === 2023 && d.getMonth() === 2) return 1.2 + Math.cos(index) * 0.4;
      return -0.8 + Math.sin(index / 10) * 0.2 + Math.random() * 0.1;
    }
  },
  HOUST: {
    frequency: 'monthly',
    getValue: (date, index, total) => {
      const year = new Date(date).getFullYear();
      // Housing starts in thousands. Fluctuate around 1000 - 1800. Low in COVID, peak 2022, down in 2023/2024.
      if (year === 2020) return 1100 + Math.sin(index) * 150;
      if (year === 2021 || year === 2022) return 1600 + Math.cos(index) * 150;
      if (year >= 2024) return 1380 + Math.sin(index) * 80;
      return 1200 + Math.sin(index / 2) * 120;
    }
  },
  PERMIT: {
    frequency: 'monthly',
    getValue: (date, index, total) => {
      // Building permits in thousands. Close to housing starts but slightly higher.
      const h = mockConfigs.HOUST.getValue(date, index, total);
      return Math.round(h * 1.08 + Math.sin(index) * 20);
    }
  },
  MORTGAGE30US: {
    frequency: 'weekly',
    getValue: (date, index, total) => {
      const d = new Date(date);
      // 30Y mortgage. 3.8% -> 2.6% in 2021 -> 7.8% in 2023 -> 6.8% in 2026.
      if (d < new Date('2020-03-01')) return 4.0 + Math.sin(index / 15) * 0.4;
      if (d < new Date('2021-12-01')) return 2.9 - (index / total) * 0.3 + Math.cos(index / 10) * 0.15;
      if (d < new Date('2023-11-01')) {
        const progress = (d - new Date('2021-12-01')) / (new Date('2023-11-01') - new Date('2021-12-01'));
        return 3.0 + progress * 4.8 + Math.sin(index / 8) * 0.2;
      }
      const progress = (d - new Date('2023-11-01')) / (new Date('2026-05-30') - new Date('2023-11-01'));
      return 7.8 - progress * 1.0 + Math.sin(index / 10) * 0.15;
    }
  },
  CSUSHPINSA: {
    frequency: 'monthly',
    getValue: (date, index, total) => {
      // Case-Shiller index. Starts 165, rises to 318 in 2026.
      return 165 + (index / total) * 153 + Math.sin(index / 5) * 2;
    }
  }
};

console.log('Generating mock FRED files in cache...');
Object.keys(mockConfigs).forEach(id => {
  const config = mockConfigs[id];
  const csvPath = path.join(cacheDir, `${id}.csv`);
  
  if (fs.existsSync(csvPath)) {
    console.log(`[EXISTS] Cache file ${id}.csv already exists, skipping.`);
    return;
  }
  
  const dates = generateDates(config.frequency);
  const rows = [`observation_date,${id}`];
  
  dates.forEach((date, idx) => {
    const val = config.getValue(date, idx, dates.length);
    rows.push(`${date},${val.toFixed(3)}`);
  });
  
  fs.writeFileSync(csvPath, rows.join('\n') + '\n', 'utf8');
  console.log(`[CREATED] Generated ${dates.length} mock points for ${id}`);
});

console.log('All mock cache files generated successfully!');
