import { createClient } from '@supabase/supabase-js';

export async function handler(event, context) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  try {
    const {
      name,
      registration_number,
      registrationNumber,
      email,
      password,
      mobile,
      village,
      block,
      union,
      union_name,
      unionName,
      upazila,
    } = JSON.parse(event.body || '{}');

    const finalRegNumber = (registration_number || registrationNumber || '').trim();
    const finalEmail = (email || '').trim().toLowerCase();
    const finalMobile = (mobile || '').trim();
    const finalUnion = (union_name || unionName || union || '').trim();

    if (!name || !finalRegNumber || !finalEmail || !password || !finalMobile) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Missing required fields: name, registration_number, email, password, mobile',
        }),
      };
    }

    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Supabase environment variables not configured on Netlify.' }),
      };
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Create Supabase Auth user
    let authUserId = null;
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: finalEmail,
        password,
        options: {
          data: {
            name: name.trim(),
            registration_number: finalRegNumber,
            mobile: finalMobile,
            village: (village || '').trim(),
            block: (block || '').trim(),
            union: finalUnion,
            upazila: (upazila || '').trim(),
            role: 'dealer',
          },
        },
      });

      if (!authError && authData && authData.user) {
        authUserId = authData.user.id;
      }
    } catch (e) {
      console.warn('Auth creation notice:', e);
    }

    // 2. Insert into dealers table
    const { error } = await supabase
      .from('dealers')
      .insert([
        {
          user_id: authUserId,
          name: name.trim(),
          registration_number: finalRegNumber,
          email: finalEmail,
          mobile: finalMobile,
          village: (village || '').trim(),
          block: (block || '').trim(),
          union_name: finalUnion,
          upazila: (upazila || '').trim(),
          status: 'pending',
        },
      ]);

    if (error) {
      const errText = `${error.message || ''} ${error.details || ''}`.toLowerCase();
      let userMsg = error.message;

      if (errText.includes('registration_number')) {
        userMsg = `Registration Number "${finalRegNumber}" is already registered.`;
      } else if (errText.includes('email')) {
        userMsg = `Email "${finalEmail}" is already registered.`;
      } else if (errText.includes('mobile')) {
        userMsg = `Mobile number "${finalMobile}" is already registered.`;
      }

      return {
        statusCode: 400,
        body: JSON.stringify({ error: userMsg }),
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Dealer registered successfully',
        userId: authUserId,
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || 'Server error' }),
    };
  }
}
