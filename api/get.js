module.exports = async (req, res) => {
  // Xử lý preflight request (OPTIONS)
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).send('');
  }

  // Chỉ xử lý GET và POST
  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Lấy scriptId từ query string
  const { scriptId, ...otherParams } = req.query;
  if (!scriptId) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(400).json({ error: 'Missing scriptId parameter' });
  }

  // Tạo URL GAS endpoint động
  let gasEndpoint = `https://script.google.com/macros/s/${scriptId}/exec`;
  
  try {
    let response;
    
    if (req.method === 'GET') {
      // Thêm các query parameters khác vào URL
      const params = new URLSearchParams(otherParams);
      if (params.toString()) {
        gasEndpoint += `?${params.toString()}`;
      }
      
      response = await fetch(gasEndpoint, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Vercel-Proxy/1.0)',
        },
      });
    } else {
      // POST request
      response = await fetch(gasEndpoint, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; Vercel-Proxy/1.0)',
        },
        body: JSON.stringify(req.body || {}),
      });
    }

    // Kiểm tra content-type của response
    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      // Response là JSON
      const data = await response.json();
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Content-Type', 'application/json');
      res.status(response.status).json(data);
    } else {
      // Response là HTML hoặc text khác
      const text = await response.text();
      
      // Kiểm tra xem có phải là lỗi HTML không
      if (text.includes('<!DOCTYPE') || text.includes('<html')) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(500).json({ 
          error: 'GAS endpoint returned HTML instead of JSON. Please check your script deployment and permissions.',
          details: 'Make sure your Google Apps Script is deployed as a web app with proper permissions.',
          htmlContent: text
        });
      }
      
      // Thử parse text như JSON
      try {
        const data = JSON.parse(text);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'application/json');
        res.status(response.status).json(data);
      } catch (parseError) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(500).json({ 
          error: 'Invalid response format from GAS endpoint',
          response: text.substring(0, 200) + (text.length > 200 ? '...' : '')
        });
      }
    }
    
  } catch (error) {
    console.error('GAS Proxy Error:', error);
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(500).json({ 
      error: `Failed to fetch GAS endpoint: ${error.message}`,
      details: 'Check if the scriptId is correct and the script is properly deployed.'
    });
  }
};