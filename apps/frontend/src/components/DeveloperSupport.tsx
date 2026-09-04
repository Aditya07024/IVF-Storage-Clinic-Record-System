import React, { useState, useEffect } from 'react';
import {
  LifeBuoy,
  Mail,
  Phone,
  MessageSquare,
  Send,
  CheckCircle2,
  Code2,
  HelpCircle,
  ChevronDown,
  ExternalLink,
  Clock,
  ClipboardList,
} from 'lucide-react';
import { apiRequest, formatTimestampDDMMYYYY } from '../api/client';

export const DeveloperSupport: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [category, setCategory] = useState('Technical Support');
  const [priority, setPriority] = useState('NORMAL');
  const [message, setMessage] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [ticketRef, setTicketRef] = useState<string | null>(null);

  // Saved Tickets History State
  const [tickets, setTickets] = useState<any[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);

  // FAQ Collapsible State
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    setLoadingTickets(true);
    try {
      const res = await apiRequest('/api/support/tickets');
      if (res.success && res.tickets) {
        setTickets(res.tickets);
      }
    } catch {
      // fallback
    } finally {
      setLoadingTickets(false);
    }
  };

  const handleSendInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !name.trim()) return;

    setSubmitting(true);
    const generatedRef = `TICKET-2026-${Math.floor(100000 + Math.random() * 900000)}`;

    try {
      await apiRequest('/api/support/ticket', {
        method: 'POST',
        body: JSON.stringify({
          ticketRef: generatedRef,
          name: name.trim(),
          email: email.trim(),
          category,
          priority,
          message: message.trim(),
        }),
      });

      setTicketRef(generatedRef);
      fetchTickets();

      // Construct pre-filled Gmail Compose URL
      const subject = `[IVF Support Request] ${category} - ${priority} (${generatedRef})`;
      const bodyText = `IVF Clinic Support Ticket Reference: ${generatedRef}\nSubmitted By: ${name.trim()} (${email.trim()})\nCategory: ${category}\nPriority: ${priority}\n\nMessage Details:\n${message.trim()}`;
      
      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=adityakumar07024@gmail.com&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`;
      
      // Open Gmail directly in a new tab
      window.open(gmailUrl, '_blank');
    } catch {
      setTicketRef(generatedRef);
      const subject = `[IVF Support Request] ${category} - ${priority} (${generatedRef})`;
      const bodyText = `IVF Clinic Support Ticket Reference: ${generatedRef}\nSubmitted By: ${name.trim()} (${email.trim()})\nCategory: ${category}\nPriority: ${priority}\n\nMessage Details:\n${message.trim()}`;
      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=adityakumar07024@gmail.com&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`;
      window.open(gmailUrl, '_blank');
    } finally {
      setSubmitting(false);
    }
  };

  const faqs = [
    {
      q: 'How do I thaw a straw and free physical Viso Tube capacity?',
      a: 'Navigate to the Patient Directory or Thaw tab, select the patient record, pick the active straw(s) you wish to thaw, enter embryologist clinical notes, and click "Execute Thaw & Liberate Capacity". The system will update the straw status to THAWED and immediately liberate space in that Viso Tube.',
    },
    {
      q: 'How does the 8-Step Heatmap Scale work?',
      a: 'The storage heatmap scale represents physical canister occupancy from 0% (White/Pale) to 100% (Deep Red). It helps staff quickly identify available capacity across Level 1 & Level 2 Viso Tubes.',
    },
    {
      q: 'What should I do if an OCR handwritten form scan fails?',
      a: 'Ensure the photo or scan has adequate lighting and sharp focus. You can crop unneeded background before running Google Cloud Vision OCR. Once processed, staff can review and edit parsed fields before saving.',
    },
    {
      q: 'How long do staff user login sessions remain active?',
      a: 'Staff remain active for 24 hours with automatic silent background token renewal, ensuring uninterrupted operations during clinic shifts.',
    },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-teal-950 p-6 m-3 sm:p-8 rounded-3xl text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/20 rounded-full border border-emerald-500/30 text-emerald-300 text-xs font-mono font-bold">
              <Code2 className="w-3.5 h-3.5" />
              <span>DEVELOPER & TECHNICAL SUPPORT CENTER</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Need Help or Custom Integration?
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed font-medium">
              Contact our IVF software engineering and lead development team directly for technical assistance, feature requests, system training, or custom clinical integrations.
            </p>
          </div>
        </div>
      </div>

      {/* Developer Profile & Direct Contact Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Contact Method 1: Email (BLACK BUTTON) */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4 flex flex-col justify-between hover:border-slate-400 transition-all group">
          <div className="space-y-3">
            <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-900 group-hover:scale-105 transition-transform">
              <Mail className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Direct Developer Email</h3>
              <p className="text-xs text-slate-500 font-medium">Send bug logs, system questions, or technical requests.</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 font-mono text-xs font-bold text-slate-800 break-all">
              adityakumar07024@gmail.com
            </div>
          </div>

          <a
            href="mailto:adityakumar07024@gmail.com?subject=IVF%20Clinic%20System%20Support%20Request"
            className="w-full py-3 bg-slate-900 hover:bg-black text-white font-bold text-xs rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95 ring-2 ring-slate-900/20"
          >
            <Mail className="w-4 h-4 text-slate-300" />
            <span>Send Email to Developer</span>
            <ExternalLink className="w-3.5 h-3.5 opacity-80" />
          </a>
        </div>

        {/* Contact Method 2: Direct Phone / WhatsApp (BLACK BUTTON) */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4 flex flex-col justify-between hover:border-slate-400 transition-all group">
          <div className="space-y-3">
            <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-900 group-hover:scale-105 transition-transform">
              <Phone className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Phone & WhatsApp Support</h3>
              <p className="text-xs text-slate-500 font-medium">Instant developer contact for urgent clinical assistance.</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 font-mono text-xs font-bold text-slate-800">
              +91 8650970092
            </div>
          </div>

          <a
            href="https://wa.me/918650970092?text=Hello%20Developer%2C%20I%20need%20support%20with%20the%20IVF%20Clinic%20Record%20System"
            target="_blank"
            rel="noreferrer"
            className="w-full py-3 bg-slate-900 hover:bg-black text-white font-bold text-xs rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95 ring-2 ring-slate-900/20"
          >
            <MessageSquare className="w-4 h-4 text-slate-300" />
            <span>Chat on WhatsApp (+91 8650970092)</span>
            <ExternalLink className="w-3.5 h-3.5 opacity-80" />
          </a>
        </div>

        {/* Contact Method 3: Support SLA & Info */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-700">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Priority Support SLA</h3>
              <p className="text-xs text-slate-500 font-medium">Fast response for active medical & laboratory staff.</p>
            </div>
            <div className="space-y-1.5 text-xs text-slate-700">
              <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                <span className="text-slate-500">Urgent Clinical:</span>
                <strong className="text-rose-700 font-mono">&lt; 30 Mins</strong>
              </div>
              <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                <span className="text-slate-500">Standard Request:</span>
                <strong className="text-emerald-700 font-mono">&lt; 2 Hours</strong>
              </div>
            </div>
          </div>

          <div className="p-3 bg-slate-100 rounded-xl border border-slate-300 text-[11px] text-slate-900 font-bold font-mono text-center">
            24/7 Monitoring & System Backups Active
          </div>
        </div>
      </div>

      {/* Main Support Form & FAQ Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left 3 Columns: Developer Support Ticket Form */}
        <div className="lg:col-span-3 bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Send className="w-5 h-5 text-slate-900" />
              <span>Contact Developer / Submit Technical Ticket</span>
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Fill out this form to log a ticket directly into the system database for our engineering team.
            </p>
          </div>

          {ticketRef ? (
            <div className="p-6 bg-emerald-50 rounded-2xl border border-emerald-200 space-y-4 animate-in zoom-in-95">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Thank You!</h3>
                  {/* <p className="text-xs text-emerald-800 font-mono font-bold">Ref Code: {ticketRef}</p> */}
                </div>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed font-medium">
                The developer will contact you soon...
              </p>
              
              <div className="flex flex-wrap items-center gap-2 pt-2">
                {/* <a
                  href={`https://mail.google.com/mail/?view=cm&fs=1&to=adityakumar07024@gmail.com&su=${encodeURIComponent(`[IVF Support Request] ${category} - ${priority} (${ticketRef})`)}&body=${encodeURIComponent(`IVF Clinic Support Ticket Reference: ${ticketRef}\nSubmitted By: ${name} (${email})\nCategory: ${category}\nPriority: ${priority}\n\nMessage Details:\n${message}`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2.5 bg-slate-900 hover:bg-black text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5"
                >
                  <Mail className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Open Gmail with Typed Message</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a> */}

                <a
                  href={`mailto:adityakumar07024@gmail.com?subject=${encodeURIComponent(`[IVF Support Request] ${category} - ${priority} (${ticketRef})`)}&body=${encodeURIComponent(`IVF Clinic Support Ticket Reference: ${ticketRef}\nSubmitted By: ${name} (${email})\nCategory: ${category}\nPriority: ${priority}\n\nMessage Details:\n${message}`)}`}
                  className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Open System Mail App</span>
                </a>

                <button
                  onClick={() => {
                    setTicketRef(null);
                    setMessage('');
                  }}
                  className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl transition-all"
                >
                  Submit Another Request
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSendInquiry} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Your Name / Staff ID</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Dr. Bhakti Mehta (STAFF001)"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-900 focus:outline-none focus:border-slate-800 font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Contact Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. doctor@clinic.com"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-900 focus:outline-none focus:border-slate-800 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-900 focus:outline-none focus:border-slate-800 font-bold"
                  >
                    <option value="Technical Support">Technical Support</option>
                    <option value="Bug Report">Bug Report</option>
                    <option value="Feature Request">Feature Request</option>
                    <option value="System Training">System Training</option>
                    <option value="Custom Integration">Custom Integration</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Priority Level</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-900 focus:outline-none focus:border-slate-800 font-bold"
                  >
                    <option value="LOW">Low (General Query)</option>
                    <option value="NORMAL">Normal Request</option>
                    <option value="HIGH">High Priority</option>
                    <option value="URGENT">Urgent Clinical Request</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Message Details</label>
                <textarea
                  rows={4}
                  required
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe your question, request, or issue in detail..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-900 focus:outline-none focus:border-slate-800 font-medium"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-slate-900 hover:bg-black text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50"
              >
                {submitting ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Submit Developer Support Request</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Right 2 Columns: System FAQs & Technical Details */}
        <div className="lg:col-span-2 space-y-5">
          {/* FAQ Accordion */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-slate-900" />
                <span>Frequently Asked Questions</span>
              </h2>
            </div>

            <div className="space-y-2">
              {faqs.map((faq, idx) => {
                const isOpen = openFaq === idx;
                return (
                  <div key={idx} className="border border-slate-200 rounded-2xl overflow-hidden">
                    <button
                      onClick={() => setOpenFaq(isOpen ? null : idx)}
                      className="w-full p-3 bg-slate-50 hover:bg-slate-100 text-left text-xs font-bold text-slate-900 flex items-center justify-between transition-colors"
                    >
                      <span>{faq.q}</span>
                      <ChevronDown className={`w-4 h-4 text-slate-500 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isOpen && (
                      <div className="p-3 bg-white text-xs text-slate-600 leading-relaxed font-medium border-t border-slate-200">
                        {faq.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Persistent Support Ticket History Table */}
      {/* <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-slate-900" />
            <span>Logged Support Tickets & Clinical Inquiry History ({tickets.length})</span>
          </h2>
          <button
            onClick={fetchTickets}
            className="text-xs font-mono font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-1 rounded-lg border border-slate-300 transition-colors"
          >
            Refresh Logged Tickets
          </button>
        </div>

        {loadingTickets ? (
          <div className="p-6 text-center text-xs text-slate-500 font-mono">
            Loading logged ticket history from database...
          </div>
        ) : tickets.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500 font-medium bg-slate-50 rounded-2xl border border-slate-200">
            No support tickets logged yet. Submit a request using the form above to track engineering tickets here.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3">Ticket Ref Code</th>
                  <th className="py-2.5 px-3">Date & Time</th>
                  <th className="py-2.5 px-3">Submitted By</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Priority</th>
                  <th className="py-2.5 px-3 font-sans">Details</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-800">
                {tickets.map((t: any) => {
                  let details: any = {};
                  try {
                    details = JSON.parse(t.newData || '{}');
                  } catch {
                    details = {};
                  }

                  return (
                    <tr key={t.id} className="hover:bg-slate-50">
                      <td className="py-3 px-3 font-bold text-slate-900">{t.entityId || details.ticketRef}</td>
                      <td className="py-3 px-3 text-slate-600">{formatTimestampDDMMYYYY(t.createdAt)}</td>
                      <td className="py-3 px-3 font-semibold text-slate-900">
                        {details.name || t.userName}
                        {details.email && <div className="text-[10px] text-slate-500 font-normal">{details.email}</div>}
                      </td>
                      <td className="py-3 px-3 text-slate-700 font-medium">{details.category || 'Support'}</td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          details.priority === 'URGENT'
                            ? 'bg-rose-100 text-rose-900 border-rose-300'
                            : details.priority === 'HIGH'
                            ? 'bg-amber-100 text-amber-900 border-amber-300'
                            : 'bg-slate-100 text-slate-800 border-slate-300'
                        }`}>
                          {details.priority || 'NORMAL'}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-sans text-slate-700 max-w-xs truncate">{details.message || '—'}</td>
                      <td className="py-3 px-3">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold border bg-emerald-100 text-emerald-900 border-emerald-300">
                          {details.status || 'RECEIVED & LOGGED'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div> */}
    </div>
  );
};
