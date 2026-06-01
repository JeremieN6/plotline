(async ()=>{
  try {
    const res = await fetch('http://localhost:3000/test');
    const text = await res.text();
    console.log('status', res.status);
    console.log('contains Test page?', text.includes('Test page'));
    const idx = text.indexOf('<div id="__nuxt"');
    console.log('snippet:', text.slice(idx, idx + 800));
  } catch (err) {
    console.error('fetch error', err);
    process.exit(1);
  }
})();
