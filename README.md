# Balance Buddy

Build a ready-to-use mobile app with the MVP below:

import React, { useState } from "react";
import { ArrowLeft, Plus, MessageCircle, Search, X, Pencil, Check } from "lucide-react";

// ---------- helpers ----------
const naira = (n) => "₦" + Math.round(n).toLocaleString("en-NG");

const todayISO = () => new Date().toISOString().slice(0, 10);

const daysSince = (iso) => {
  const d = (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24);
  return Math.floor(d);
};

const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short" });

const balanceOf = (c) =>
  c.txns.reduce((sum, t) => sum + (t.type === "sale" ? t.amount : -t.amount), 0);

const lastActivity = (c) =>
  c.txns.length ? c.txns[c.txns.length - 1].date : c.createdAt;

const waPhone = (raw) => {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("234")) return digits;
  if (digits.startsWith("0")) return "234" + digits.slice(1);
  return "234" + digits;
};

const waLink = (phone, text) =>
  `https://wa.me/${waPhone(phone)}?text=${encodeURIComponent(text)}`;

// ---------- seed data ----------
const seed = [
  {
    id: "c1",
    name: "Mama Ngozi",
    phone: "08031234567",
    createdAt: "2026-06-01",
    txns: [
      { id: "t1", type: "sale", amount: 45000, date: "2026-06-02", note: "2 bags rice" },
      { id: "t2", type: "payment", amount: 20000, date: "2026-06-10", note: "" },
      { id: "t3", type: "sale", amount: 12000, date: "2026-07-15", note: "Cooking oil" },
    ],
  },
  {
    id: "c2",
    name: "Emeka Auto Parts",
    phone: "08025551234",
    createdAt: "2026-05-20",
    txns: [
      { id: "t4", type: "sale", amount: 130000, date: "2026-05-22", note: "Brake pads x10" },
      { id: "t5", type: "payment", amount: 130000, date: "2026-06-01", note: "" },
    ],
  },
  {
    id: "c3",
    name: "Blessing Salon",
    phone: "07098765432",
    createdAt: "2026-04-10",
    txns: [
      { id: "t6", type: "sale", amount: 8500, date: "2026-04-11", note: "Hair products" },
    ],
  },
];

const OVERDUE_DAYS = 14;

export default function DebtTracker() {
  const [businessName, setBusinessName] = useState("Amaka Provisions");
  const [editingName, setEditingName] = useState(false);
  const [customers, setCustomers] = useState(seed);
  const [screen, setScreen] = useState("list"); // list | detail | addCustomer | addTxn
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState("");
  const [txnType, setTxnType] = useState("sale");
  const [form, setForm] = useState({ name: "", phone: "", amount: "", note: "" });

  const selected = customers.find((c) => c.id === selectedId);
  const totalOwed = customers.reduce((s, c) => s + Math.max(balanceOf(c), 0), 0);

  const filtered = customers
    .filter((c) => c.name.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => balanceOf(b) - balanceOf(a));

  const resetForm = () => setForm({ name: "", phone: "", amount: "", note: "" });

  const addCustomer = () => {
    if (!form.name.trim() || !form.phone.trim()) return;
    const c = {
      id: "c" + Date.now(),
      name: form.name.trim(),
      phone: form.phone.trim(),
      createdAt: todayISO(),
      txns: [],
    };
    setCustomers((cs) => [...cs, c]);
    resetForm();
    setScreen("list");
  };

  const addTxn = () => {
    const amt = parseFloat(form.amount);
    if (!amt || amt <= 0 || !selectedId) return;
    const t = { id: "t" + Date.now(), type: txnType, amount: amt, date: todayISO(), note: form.note.trim() };
    setCustomers((cs) =>
      cs.map((c) => (c.id === selectedId ? { ...c, txns: [...c.txns, t] } : c))
    );
    resetForm();
    setScreen("detail");
  };

  return (
    


      @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600;700&display=swap');
        .mono { font-family: 'IBM Plex Mono', monospace; }
        .stamp {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 10px;
          letter-spacing: 0.06em;
          font-weight: 700;
          padding: 2px 7px;
          border: 1.5px solid currentColor;
          border-radius: 3px;
          display: inline-block;
          transform: rotate(-3deg);
          text-transform: uppercase;
        }
        .ledger-row { border-bottom: 1px solid var(--line); }
        .ledger-row:last-child { border-bottom: none; }
        .btn-primary {
          background: var(--ink); color: var(--paper-raised);
        }
        .btn-primary:active { opacity: 0.85; }
        .btn-wa { background: var(--wa); color: #fff; }
        .input-field {
          background: var(--paper-raised);
          border: 1px solid var(--line);
          color: var(--ink);
        }
        .input-field:focus { outline: 2px solid var(--ink); outline-offset: -1px; }
        .perforated {
          border: 1.5px dashed var(--line);
        }
      `}

      


        {/* ===== LIST SCREEN ===== */}
        {screen === "list" && (
          <>
            


              


                {editingName ? (
                  


                     setBusinessName(e.target.value)}
                      autoFocus
                    />
                     setEditingName(false)} style={{ color: "var(--paid)" }}>
                      
                    
                  


                ) : (
                  


                    
                      {businessName.toUpperCase()}
                    
                     setEditingName(true)} style={{ color: "var(--ink-soft)" }}>
                      
                    
                  


                )}
              


              


                {naira(totalOwed)}
              


              


                total outstanding across {customers.length} customers
              


            



            


              


                
                 setQuery(e.target.value)}
                  className="bg-transparent w-full text-sm outline-none"
                  style={{ color: "var(--ink)" }}
                />
              


            



            


              


                {filtered.length === 0 && (
                  


                    No customers yet. Tap + to add one.
                  


                )}
                {filtered.map((c) => {
                  const bal = balanceOf(c);
                  const overdue = bal > 0 && daysSince(lastActivity(c)) > OVERDUE_DAYS;
                  return (
                     {
                        setSelectedId(c.id);
                        setScreen("detail");
                      }}
                      className="ledger-row w-full flex items-center justify-between px-4 py-3 text-left"
                    >
                      


                        

{c.name}


                        


                          last activity {fmtDate(lastActivity(c))}
                          {overdue && (
                            
                              overdue
                            
                          )}
                        


                      


                      

 0 ? "var(--debt)" : bal < 0 ? "var(--paid)" : "var(--ink-soft)" }}
                      >
                        {bal === 0 ? "settled" : naira(Math.abs(bal))}
                      


                    
                  );
                })}
              


            



             setScreen("addCustomer")}
              className="btn-primary rounded-full flex items-center justify-center shadow-lg"
              style={{ position: "fixed", bottom: 24, right: "calc(50% - 215px + 18px)", width: 54, height: 54 }}
            >
              
            
          
        )}

        {/* ===== ADD CUSTOMER ===== */}
        {screen === "addCustomer" && (
          


            


               { resetForm(); setScreen("list"); }}>
                
              
              

New customer


            


            Name
             setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Chidi Electronics"
            />
            WhatsApp number
             setForm({ ...form, phone: e.target.value })}
              placeholder="080..."
            />
            
              Save customer
            
          


        )}

        {/* ===== ADD TRANSACTION ===== */}
        {screen === "addTxn" && selected && (
          


            


               { resetForm(); setScreen("detail"); }}>
                
              
              

{selected.name}


            



            


              {["sale", "payment"].map((t) => (
                 setTxnType(t)}
                  className="flex-1 py-2 text-sm font-semibold"
                  style={{
                    background: txnType === t ? "var(--ink)" : "var(--paper-raised)",
                    color: txnType === t ? "var(--paper-raised)" : "var(--ink-soft)",
                  }}
                >
                  {t === "sale" ? "Sold on credit" : "Payment received"}
                
              ))}
            



            Amount (₦)
             setForm({ ...form, amount: e.target.value.replace(/[^0-9.]/g, "") })}
              placeholder="0"
              inputMode="decimal"
            />
            Note (optional)
             setForm({ ...form, note: e.target.value })}
              placeholder={txnType === "sale" ? "e.g. 2 bags cement" : "e.g. part payment"}
            />
            
              Save {txnType === "sale" ? "sale" : "payment"}
            
          


        )}

        {/* ===== DETAIL SCREEN ===== */}
        {screen === "detail" && selected && (
          <>
            


              


                 setScreen("list")}>
                  
                
                


                  

{selected.name}


                  

{selected.phone}


                


              



              


                

Balance


                

 0 ? "var(--debt)" : "var(--paid)" }}
                >
                  {naira(Math.abs(balanceOf(selected)))}
                


                


                  {balanceOf(selected) > 0 ? "owed to you" : "settled"}
                


              



              


                 { setTxnType("sale"); setScreen("addTxn"); }}
                  className="btn-primary rounded py-2.5 text-sm font-semibold"
                >
                  + Record sale
                
                 { setTxnType("payment"); setScreen("addTxn"); }}
                  className="rounded py-2.5 text-sm font-semibold perforated"
                  style={{ background: "var(--paper-raised)", color: "var(--paid)" }}
                >
                  + Record payment
                
              



              {balanceOf(selected) > 0 && (
                
                   Send reminder on WhatsApp
                
              )}
            



            


              


                HISTORY
              


              


                {selected.txns.length === 0 && (
                  


                    No transactions yet.
                  


                )}
                {[...selected.txns].reverse().map((t) => (
                  


                    


                      


                        {t.type === "sale" ? "Sold on credit" : "Payment received"}
                      


                      


                        {fmtDate(t.date)}{t.note ? ` · ${t.note}` : ""}
                      


                    


                    


                      


                        {t.type === "sale" ? "+" : "−"}{naira(t.amount)}
                      


                      {t.type === "sale" && (
                        
                          
                        
                      )}
                    


                  


                ))}
              


            


          
        )}
      


    
  );
}

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://trackdebt.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/c67719d7-aced-4029-a162-cdb772e4c89e).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
