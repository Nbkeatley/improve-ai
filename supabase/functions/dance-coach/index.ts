import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured');

    const { moments } = await req.json();

    if (!moments || !Array.isArray(moments) || moments.length === 0) {
      return new Response(JSON.stringify({ error: 'No moments provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build a prompt with posecode context for each moment
    const momentDescriptions = moments.map((m: any, i: number) => {
      return `Moment ${i + 1} (${m.timeRange}, average accuracy: ${m.avgScore}%):
Worst body parts: ${m.worstSegments}
${m.posecodeContext}`;
    }).join('\n\n');

    const systemPrompt = `You are a professional dance coach giving feedback after a practice session. 
You are reviewing the student's 3 weakest moments where their pose differed most from the reference.

For each moment, provide:
1. A clear, encouraging coaching observation (1-2 sentences) describing what went wrong in dance terminology
2. A specific, actionable tip to fix it (1 sentence)

Use dance terminology naturally (e.g., "port de bras", "alignment", "extension", "turnout", "spotting"). 
Be specific about body parts and movements. Be encouraging but honest.
Keep each moment's feedback to 3 sentences maximum.

Format your response as JSON array:
[{"observation": "...", "tip": "..."}, ...]`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Here are the ${moments.length} worst moments from my dance practice session:\n\n${momentDescriptions}\n\nPlease provide coaching feedback for each moment.` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "provide_coaching_feedback",
              description: "Return coaching feedback for each worst moment",
              parameters: {
                type: "object",
                properties: {
                  feedback: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        observation: { type: "string", description: "What went wrong in dance terminology (1-2 sentences)" },
                        tip: { type: "string", description: "Specific actionable fix (1 sentence)" }
                      },
                      required: ["observation", "tip"],
                      additionalProperties: false
                    }
                  }
                },
                required: ["feedback"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "provide_coaching_feedback" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded, please try again later.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Payment required, please add credits.' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errText = await response.text();
      console.error('AI gateway error:', response.status, errText);
      return new Response(JSON.stringify({ error: 'AI gateway error' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    
    // Extract tool call result
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify({ feedback: parsed.feedback }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fallback: try to parse from content
    const content = data.choices?.[0]?.message?.content || '[]';
    return new Response(JSON.stringify({ feedback: JSON.parse(content) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('dance-coach error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
