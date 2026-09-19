import { objectBody, text, date, fail } from './validation.js';
export const currencies = ['INR','USD','EUR','GBP','AUD','CAD','SGD','AED','JPY'];
export const categories = ['Food','Stay','Transport','Activities','Shopping','Other'];
export function money(value, currency, allowZero = false) {
  // Parse the decimal string to integer minor units; never sum floating-point money.
  const pattern = currency === 'JPY' ? /^\d{1,9}$/ : /^\d{1,9}(\.\d{1,2})?$/;
  if (typeof value !== 'string' || !pattern.test(value)) fail(400, `Enter a valid amount${currency === 'JPY' ? ' in whole yen' : ' with at most 2 decimal places'}.`);
  const [whole, decimal = ''] = value.split('.');
  const minor = currency === 'JPY' ? Number(whole) : Number(whole)*100 + Number(decimal.padEnd(2,'0'));
  if ((!allowZero && minor === 0) || !Number.isSafeInteger(minor)) fail(400, 'Expense amount must be greater than zero.');
  return minor;
}
export function expenseInput(body, currency) {
  objectBody(body);
  if (body.currency !== currency) fail(409, 'The trip currency has changed. Reload before saving.');
  if (!categories.includes(body.category)) fail(400, 'Choose a valid expense category.');
  if (!date(body.date)) fail(400, 'Use a real expense date in YYYY-MM-DD format.');
  return { title: text(body.title, 'Description', 120), amountMinor: money(body.amount, currency), category: body.category, date: body.date, note: text(body.note, 'Note', 1000, true) };
}
export function finances(trip) {
  const byCategory = Object.fromEntries(categories.map(category=>[category,0]));
  let totalMinor = 0;
  for (const expense of trip.expenses) { totalMinor += expense.amountMinor; byCategory[expense.category] += expense.amountMinor; }
  return { currency: trip.currency, budgetMinor: trip.budgetMinor, expenses: [...trip.expenses].sort((a,b)=>b.date.localeCompare(a.date)), totalMinor, remainingMinor: trip.budgetMinor === null ? null : trip.budgetMinor-totalMinor, byCategory, categories, currencies };
}
export function registerExpenses(app) {
  app.get('/api/trips/:tripId/expenses', (req,res)=>res.json(finances(req.trip)));
  app.patch('/api/trips/:tripId/budget', async (req,res)=>{
    objectBody(req.body);
    if (!currencies.includes(req.body.currency)) fail(400, 'Choose a supported currency.');
    if (req.body.currency !== req.trip.currency && req.trip.expenses.length) fail(409, 'Remove existing expenses before changing currency. Amounts are not converted automatically.');
    req.trip.currency = req.body.currency;
    req.trip.budgetMinor = req.body.budget === null ? null : money(req.body.budget, req.body.currency, true);
    await req.trip.save(); res.json(finances(req.trip));
  });
  app.post('/api/trips/:tripId/expenses', async (req,res)=>{
    const values = expenseInput(req.body, req.trip.currency);
    if (req.trip.expenses.length >= 500) fail(400, 'A trip can contain up to 500 expenses.');
    req.trip.expenses.push(values); await req.trip.save(); res.status(201).json(finances(req.trip));
  });
  app.patch('/api/trips/:tripId/expenses/:expenseId', async (req,res)=>{
    const expense = req.trip.expenses.id(req.params.expenseId);
    if (!expense) fail(404, 'Expense not found in this trip.');
    Object.assign(expense, expenseInput(req.body, req.trip.currency));
    await req.trip.save(); res.json(finances(req.trip));
  });
  app.delete('/api/trips/:tripId/expenses/:expenseId', async (req,res)=>{
    const expense = req.trip.expenses.id(req.params.expenseId);
    if (!expense) fail(404, 'Expense not found in this trip.');
    expense.deleteOne(); await req.trip.save(); res.sendStatus(204);
  });
}
