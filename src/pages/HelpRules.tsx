import { useState } from 'react';
import { Card, Badge } from '../components/ui';
import { HelpCircleIcon, ChevronRightIcon } from '../components/icons';

const rules = [
  {
    section: 'General Rules',
    items: [
      'All participants must be present at their workstation at the start of each round.',
      'Team code must be available at all times — coordinators may request it.',
      'Participants must not communicate with other teams during any round.',
      'Suspicious activity will be flagged for coordinator review.',
      'Decisions made by the event coordinators are final.',
    ],
  },
  {
    section: 'Round-Specific Rules',
    items: [
      'Round 1 (AI IQ): No external tools, browsers, or AI assistants allowed.',
      'Rounds 2-5: BYOK (Bring Your Own Key) AI usage is permitted unless stated otherwise.',
      'Attempting to access other teams\' workstations will result in disqualification.',
      'Submitting content generated without AI where AI is required (or vice versa) is a violation.',
      'Final submissions in Rounds 4 and 5 cannot be changed once submitted.',
    ],
  },
  {
    section: 'Attempts & Scoring',
    items: [
      'Each challenge has a defined maximum attempt limit — once exhausted, no more submissions are accepted.',
      'Testing a prompt does NOT consume an attempt. Only submission does.',
      'Using hints permanently reduces the available score for that challenge.',
      'Speed bonuses are added automatically when eligibility criteria are met.',
      'Final scores will be computed automatically with no manual override.',
    ],
  },
  {
    section: 'Conduct & Integrity',
    items: [
      'Any form of cheating, plagiarism, or collusion will result in disqualification.',
      'Do not attempt to inject prompts into competition evaluation systems.',
      'Treat coordinators and fellow participants with respect.',
      'Report technical issues to a coordinator immediately — do not try to resolve them yourself.',
      'Participants who violate rules may be removed without refund or replacement.',
    ],
  },
];

const faqs = [
  {
    q: 'My API key isn\'t working. What should I do?',
    a: 'Contact a coordinator immediately. Do not attempt to share keys with other teams. A backup key will be provided if authorized.',
  },
  {
    q: 'Can I use ChatGPT, Claude, or Gemini for the rounds that allow AI?',
    a: 'Yes. You may use any LLM with your own API key (BYOK). Ensure you have sufficient credits before the round begins.',
  },
  {
    q: 'What happens if I lose internet connection during a round?',
    a: 'Your work is auto-saved locally. The system will attempt to reconnect automatically. Notify a coordinator if the problem persists.',
  },
  {
    q: 'Can my team members work simultaneously on the same challenge?',
    a: 'Yes. Both team members can collaborate on the challenge. Only one submission per team per attempt is counted.',
  },
  {
    q: 'What is BYOK?',
    a: 'BYOK stands for "Bring Your Own Key" — meaning you must use your personal API keys for AI services in rounds that allow AI usage.',
  },
];

export default function HelpRules() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 bg-orange-50 border border-orange-100 rounded-xl flex items-center justify-center">
          <HelpCircleIcon className="w-4 h-4 text-orange-500" />
        </div>
        <div>
          <h2 className="font-bold text-gray-900 font-heading">Help & Rules</h2>
          <p className="text-xs text-gray-400">Official event guidelines and frequently asked questions</p>
        </div>
      </div>

      {/* Emergency contact */}
      <div className="bg-orange-50 border border-orange-100 rounded-xl px-5 py-4 mb-6 flex items-center justify-between">
        <div>
          <div className="font-bold text-orange-800 text-sm font-heading">Need immediate help?</div>
          <div className="text-sm text-orange-600">Raise your hand or approach any coordinator in the room.</div>
        </div>
        <button className="px-4 py-2 bg-orange-500 text-white text-sm font-semibold rounded-lg hover:bg-orange-600 transition-colors font-heading">
          Contact Support
        </button>
      </div>

      {/* Rules */}
      <div className="space-y-4 mb-8">
        {rules.map((section) => (
          <Card key={section.section} className="p-5">
            <h3 className="text-sm font-bold text-gray-900 font-heading mb-3">{section.section}</h3>
            <div className="space-y-2">
              {section.items.map((item, i) => (
                <div key={i} className="flex items-start gap-2.5 text-sm text-gray-600">
                  <div className="w-5 h-5 rounded-full bg-orange-100 text-orange-500 text-xs font-bold font-heading flex items-center justify-center flex-shrink-0 mt-0.5">
                    {i + 1}
                  </div>
                  {item}
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>

      {/* FAQs */}
      <h3 className="text-sm font-bold text-gray-900 font-heading mb-3 uppercase tracking-widest text-orange-500">
        Frequently Asked Questions
      </h3>
      <div className="space-y-2">
        {faqs.map((faq, i) => (
          <Card key={i} className="overflow-hidden">
            <button
              onClick={() => setOpenFaq(openFaq === i ? null : i)}
              className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
            >
              <span className="text-sm font-semibold text-gray-900">{faq.q}</span>
              <ChevronRightIcon className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${openFaq === i ? 'rotate-90' : ''}`} />
            </button>
            {openFaq === i && (
              <div className="px-5 pb-4 text-sm text-gray-600 border-t border-gray-50">
                <div className="pt-3">{faq.a}</div>
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Resources */}
      <div className="mt-6 grid grid-cols-2 gap-3">
        {['Event Rules PDF', 'Prompt Engineering Guide', 'AI Model Reference', 'BYOK Setup Guide'].map((r) => (
          <button key={r} className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-xl hover:border-orange-200 hover:bg-orange-50 transition-all group">
            <div className="flex items-center gap-2 text-sm text-gray-700 group-hover:text-orange-700">
              <span>📄</span> {r}
            </div>
            <ChevronRightIcon className="w-4 h-4 text-gray-300 group-hover:text-orange-400" />
          </button>
        ))}
      </div>
    </div>
  );
}
