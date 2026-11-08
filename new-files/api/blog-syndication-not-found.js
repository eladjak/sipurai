export default function handler(_req, res) {
  res.status(404).setHeader('X-Robots-Tag', 'noindex');
  res.send('Not found');
}
