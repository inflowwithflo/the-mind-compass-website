// Quiz-Lead -> MailerLite
// Nimmt { email, phone, resultType: 'A'|'B'|'C', resultName } vom Quiz entgegen
// und legt die Person in MailerLite an, in der zum Ergebnis passenden Gruppe.
// Die jeweilige MailerLite-Automation ("tritt Gruppe X bei") schickt dann die
// richtige Sequenz. Anbieter wechseln = nur diese Datei anpassen.
//
// Benötigte Umgebungsvariablen (in Netlify -> Site settings -> Environment):
//   MAILERLITE_API_KEY   = API-Key aus MailerLite (Integrations -> API)
//   MAILERLITE_GROUP_A   = Gruppen-ID "Die Wachsame"        (-> Compass)
//   MAILERLITE_GROUP_B   = Gruppen-ID "Die Trägerin"        (-> Foundation)
//   MAILERLITE_GROUP_C   = Gruppen-ID "Die Stille Kämpferin"(-> Empire)
// Solange der Key fehlt, antwortet die Funktion sauber mit "not_configured",
// damit das Quiz trotzdem funktioniert (Ergebnis wird im Browser angezeigt).

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let data;
  try { data = await req.json(); } catch { return jsonRes({ ok: false, error: 'bad_request' }, 400); }

  const name = (data.name || '').trim();
  const email = (data.email || '').trim();
  const phone = (data.phone || '').trim();
  const resultType = data.resultType;
  const resultName = data.resultName || resultType || '';

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonRes({ ok: false, error: 'invalid_email' }, 400);
  }

  const API_KEY = process.env.MAILERLITE_API_KEY;
  if (!API_KEY) {
    // Noch nicht konfiguriert: nicht hart fehlschlagen, Lead geht nur nicht raus.
    console.warn('MAILERLITE_API_KEY fehlt – Lead nicht an MailerLite übergeben.');
    return jsonRes({ ok: false, reason: 'not_configured' }, 200);
  }

  const groups = {
    A: process.env.MAILERLITE_GROUP_A,
    B: process.env.MAILERLITE_GROUP_B,
    C: process.env.MAILERLITE_GROUP_C
  };
  const groupId = groups[resultType];

  const payload = {
    email,
    fields: { name, phone, quiz_ergebnis: resultName },
    groups: groupId ? [groupId] : []
  };

  try {
    const r = await fetch('https://connect.mailerlite.com/api/subscribers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': 'Bearer ' + API_KEY
      },
      body: JSON.stringify(payload)
    });
    if (!r.ok) {
      const txt = await r.text();
      console.error('MailerLite Fehler', r.status, txt);
      return jsonRes({ ok: false, error: 'mailerlite_error', status: r.status }, 502);
    }
    return jsonRes({ ok: true }, 200);
  } catch (err) {
    console.error('MailerLite Request fehlgeschlagen', err);
    return jsonRes({ ok: false, error: 'request_failed' }, 502);
  }
};

function jsonRes(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
