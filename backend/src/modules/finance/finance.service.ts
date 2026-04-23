import { FinanceRepository } from './finance.repository';

const isQuietClient = (row: Record<string, unknown> | null | undefined) =>
  Boolean(row?.is_free_or_trade) || Boolean(row?.one_time_payment);

const calculateFinanceSummary = (entries: any[]) => {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  let totalIncome = 0;
  let totalExpense = 0;
  let recurringIncomeThisMonth = 0;
  let acquisitionExpenseThisMonth = 0;
  const recurringClients = new Set<string>();

  for (const entry of entries) {
    const amount = Number(entry.amount || 0);
    const date = new Date(entry.date || now.toISOString());
    const sameMonth = date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    const client = entry.client || entry.clients || null;
    const isRecurringClient = !Boolean(client?.one_time_payment || client?.is_free_or_trade);

    if (entry.type === 'income') {
      totalIncome += amount;
      if (sameMonth && isRecurringClient) {
        recurringIncomeThisMonth += amount;
        if (entry.client_id) recurringClients.add(String(entry.client_id));
      }
    } else {
      totalExpense += amount;
      if (sameMonth && Boolean(entry.acquisition_cost)) {
        acquisitionExpenseThisMonth += amount;
      }
    }
  }

  const activeRecurringClients = recurringClients.size;
  const averageRecurringRevenue = activeRecurringClients > 0 ? recurringIncomeThisMonth / activeRecurringClients : 0;

  return {
    mrr: recurringIncomeThisMonth,
    cac: activeRecurringClients > 0 ? acquisitionExpenseThisMonth / activeRecurringClients : 0,
    ltv: averageRecurringRevenue * 12,
    total_income: totalIncome,
    total_expense: totalExpense,
    net_profit: totalIncome - totalExpense,
  };
};

export class FinanceService {
  constructor(private readonly repository: FinanceRepository) {}

  async getOverview(clientId?: string) {
    const { entries, clients } = await this.repository.getOverview(clientId);
    const visibleEntries = entries
      .filter((item) => {
        const relation = Array.isArray(item.clients) ? item.clients[0] : item.clients;
        return !relation || !isQuietClient(relation as Record<string, unknown>);
      })
      .map((item) => ({
        ...(() => {
          const relation = Array.isArray(item.clients) ? item.clients[0] : item.clients;
          return {
            client_name: relation?.name || null,
            client: relation || null,
          };
        })(),
        ...item,
        amount: Number(item.amount || 0),
      }));

    return {
      entries: visibleEntries,
      summary: calculateFinanceSummary(visibleEntries),
      clients: clients
        .filter((client) => !isQuietClient(client as Record<string, unknown>))
        .map((client) => ({
          id: String(client.id),
          name: String(client.name || 'Sem nome'),
        })),
    };
  }
}
