const { convertToModelMessages } = require('ai');
const fs = require('fs');

(async () => {
  try {
    await convertToModelMessages([{ role: 'user', content: 'hello' }]);
    fs.writeFileSync('out.txt', 'Success');
  } catch (e) {
    fs.writeFileSync('out.txt', "Error: " + e.stack);
  }
})();
