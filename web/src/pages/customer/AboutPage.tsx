import { Instagram, Facebook, Link2 } from 'lucide-react';

export default function AboutPage() {
  const links = [
    { label: 'Instagram', href: 'https://www.instagram.com/onesoul.zb', icon: Instagram, color: 'from-pink-500 to-rose-500' },
    { label: 'Facebook', href: 'https://www.facebook.com/onesoul.zb', icon: Facebook, color: 'from-blue-600 to-indigo-600' },
    { label: 'Linktree', href: 'https://linktr.ee/onesoul.zb', icon: Link2, color: 'from-green-500 to-emerald-500' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 flex items-start justify-center pt-12 px-4">
      <div className="w-full max-w-sm text-center">
        <img src={`${import.meta.env.BASE_URL}logo-full.png`} alt="OneSoul" className="h-20 mx-auto mb-6" />

        <div className="bg-white rounded-3xl shadow-xl p-8 border border-orange-100">
          <h2 className="text-2xl font-black text-slate-800 mb-6">相關連結</h2>

          <div className="space-y-4">
            {links.map(link => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center justify-center gap-3 w-full py-4 bg-gradient-to-r ${link.color} text-white font-bold text-lg rounded-xl shadow-lg hover:shadow-xl transition-all active:scale-[0.98]`}
              >
                <link.icon className="w-6 h-6" />
                {link.label}
              </a>
            ))}
          </div>
        </div>

        <p className="mt-6 text-sm text-slate-400">© 2026 OneSoul 玩獸</p>
      </div>
    </div>
  );
}
