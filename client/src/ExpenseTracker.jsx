import React, { useEffect, useRef, useState } from 'react';
import { api } from './api.js';

function factor(currency) { return currency === 'JPY' ? 1 : 100; }
function amountText(minor, currency) { return minor === null ? '' : (minor / factor(currency)).toFixed(currency === 'JPY' ? 0 : 2); }
function money(minor, currency) { return new Intl.NumberFormat('en', { style:'currency', currency }).format(minor/factor(currency)); }
const blank = () => ({ title:'', amount:'', category:'Food', date:new Date().toISOString().slice(0,10), note:'' });

export default function ExpenseTracker({ tripId }) {
  const [data,setData] = useState(null);
  const [draft,setDraft] = useState(blank);
  const [editing,setEditing] = useState(null);
  const [deleting,setDeleting] = useState(null);
  const [budget,setBudget] = useState('');
  const [currency,setCurrency] = useState('INR');
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [message,setMessage] = useState('');
  const formRef = useRef(null);
  function accept(result) { setData(result); setCurrency(result.currency); setBudget(amountText(result.budgetMinor,result.currency)); }
  async function load() { setError(''); try { accept(await api(`/trips/${tripId}/expenses`)); } catch(e) {setError(e.message);} }
  useEffect(()=>{load();},[tripId]);
  async function saveBudget(event) {
    event.preventDefault();setBusy(true);setError('');setMessage('');
    try { accept(await api(`/trips/${tripId}/budget`,{method:'PATCH',body:JSON.stringify({currency,budget:budget.trim()===''?null:budget})}));setMessage('Budget saved.'); }
    catch(e) {setError(e.message);} finally {setBusy(false);}
  }
  async function saveExpense(event) {
    event.preventDefault();setBusy(true);setError('');setMessage('');
    try { accept(await api(`/trips/${tripId}/expenses${editing?'/'+editing:''}`,{method:editing?'PATCH':'POST',body:JSON.stringify({...draft,currency:data.currency})}));setDraft(blank());setEditing(null);setMessage(editing?'Expense updated.':'Expense added.'); }
    catch(e) {setError(e.message);} finally {setBusy(false);}
  }
  async function remove(id) {
    setBusy(true);setError('');setMessage('');
    try { await api(`/trips/${tripId}/expenses/${id}`,{method:'DELETE'});accept(await api(`/trips/${tripId}/expenses`));setDeleting(null);if(editing===id){setEditing(null);setDraft(blank());}setMessage('Expense removed.'); }
    catch(e) {setError(e.message);} finally {setBusy(false);}
  }
  function edit(expense) {setEditing(expense._id);setDraft({...expense,amount:amountText(expense.amountMinor,data.currency)});formRef.current?.scrollIntoView({behavior:'smooth',block:'center'});}
  const change = e=>setDraft({...draft,[e.target.name]:e.target.value});
  return <section className="expense-section">
    <div className="eyebrow">A LITTLE CLARITY GOES A LONG WAY</div><h2 className="detail-title">Your trip, in numbers.</h2>
    <p className="muted">Track what you actually spend. Suggested admission prices stay separate.</p>
    {error && <div className="error" role="alert">{error} <button disabled={busy} onClick={load}>Reload expenses</button></div>}
    {message && <p className="success" role="status">{message}</p>}
    {!data ? !error && <p role="status">Loading expenses…</p> : <>
      <div className="money-summary">
        <div className="panel"><span>Total spent</span><strong>{money(data.totalMinor,data.currency)}</strong><small>{data.expenses.length} expense{data.expenses.length===1?'':'s'} recorded</small></div>
        <div className="panel"><span>Trip budget</span><strong>{data.budgetMinor===null?'Not set':money(data.budgetMinor,data.currency)}</strong><small>{data.currency} · one currency per trip</small></div>
        <div className={`panel ${data.remainingMinor<0?'over-budget':''}`}><span>{data.remainingMinor<0?'Over budget':'Remaining'}</span><strong>{data.remainingMinor===null?'—':money(Math.abs(data.remainingMinor),data.currency)}</strong><small>{data.remainingMinor===null?'Set a budget to track your balance':data.remainingMinor<0?'Time to review your spending':'Room for your next discovery'}</small></div>
      </div>
      <form className="panel budget-form" onSubmit={saveBudget}>
        <label>Trip currency<select value={currency} disabled={busy || data.expenses.length>0} onChange={e=>setCurrency(e.target.value)}>{data.currencies.map(c=><option key={c}>{c}</option>)}</select></label>
        <label>Budget (optional)<input type="number" min="0" max="999999999.99" step={currency==='JPY'?'1':'0.01'} value={budget} onChange={e=>setBudget(e.target.value)} placeholder="No budget set"/></label>
        <button disabled={busy} type="submit">Save budget</button>
        <p className="muted">Currency is locked while expenses exist. No automatic exchange-rate conversion.</p>
      </form>
      <div className="expense-layout">
        <section className="panel"><h2>Spending breakdown</h2>
          {data.totalMinor===0?<p className="muted">Your categories will appear as you add expenses.</p>:<div className="category-breakdown">{Object.entries(data.byCategory).filter(([,total])=>total>0).map(([category,total])=><div key={category}><div><span>{category}</span><strong>{money(total,data.currency)}</strong></div><progress aria-label={`${category} share of spending`} max={data.totalMinor} value={total}/></div>)}</div>}
          <h2 className="expense-list-title">Expense history</h2>
          {!data.expenses.length?<p className="muted">No expenses yet. Add your first meal, ticket, or hotel stay.</p>:<ul className="expense-list">{data.expenses.map(expense=><li key={expense._id}>
            <div className="expense-item-top"><div><h3>{expense.title}</h3><p className="muted">{expense.category} · {expense.date}</p></div><strong>{money(expense.amountMinor,data.currency)}</strong></div>
            {expense.note && <p className="expense-note">{expense.note}</p>}
            <div className="expense-actions">{deleting===expense._id?<><span>Remove this expense?</span><button className="danger" disabled={busy} onClick={()=>remove(expense._id)}>Confirm remove</button><button disabled={busy} onClick={()=>setDeleting(null)}>Keep expense</button></>:<><button disabled={busy} onClick={()=>edit(expense)} aria-label={`Edit expense ${expense.title}`}>Edit</button><button className="danger" disabled={busy} onClick={()=>setDeleting(expense._id)} aria-label={`Delete expense ${expense.title}`}>Delete</button></>}</div>
          </li>)}</ul>}
        </section>
        <section className="panel" ref={formRef}><h2>{editing?'Edit expense':'Add an expense'}</h2>
          <form className="expense-form" onSubmit={saveExpense}>
            <label>Description<input name="title" value={draft.title} onChange={change} maxLength={120} required placeholder="Lunch, hotel, train tickets…"/></label>
            <div className="date-fields"><label>Amount ({data.currency})<input name="amount" type="number" min={data.currency==='JPY'?'1':'0.01'} step={data.currency==='JPY'?'1':'0.01'} max="999999999.99" value={draft.amount} onChange={change} required placeholder="0.00"/></label><label>Category<select name="category" value={draft.category} onChange={change}>{data.categories.map(c=><option key={c}>{c}</option>)}</select></label></div>
            <label>Expense date<input name="date" type="date" value={draft.date} onChange={change} required/></label>
            <label>Expense note (optional)<textarea name="note" value={draft.note} onChange={change} rows={3} maxLength={1000} placeholder="Anything you want to remember"/></label>
            <div className="actions"><button className="primary" disabled={busy}>{busy?'Saving…':editing?'Update expense':'Add expense'}</button>{editing && <button type="button" disabled={busy} onClick={()=>{setEditing(null);setDraft(blank());}}>Cancel edit</button>}</div>
          </form>
        </section>
      </div>
    </>}
  </section>;
}
