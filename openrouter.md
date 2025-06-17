---
description: 
globs: 
alwaysApply: false
---

Logo
Search or ask AI a question
/
API
Models
Chat
Ranking
Login

Overview
Quickstart
FAQ
Principles
Models
Features
Privacy and Logging
Model Routing
Provider Routing
Prompt Caching
Structured Outputs
Tool Calling
Images & PDFs
Message Transforms
Uptime Optimization
Web Search
Zero Completion Insurance
Provisioning API Keys
API Reference
Overview
Streaming
Limits
Authentication
Parameters
Errors
POST
Completion
POST
Chat completion
GET
Get a generation
GET
List available models
GET
List endpoints for a model
GET
Get credits
POST
Create a Coinbase charge

Authentication

API Keys
Use Cases
BYOK
Crypto API
OAuth PKCE
MCP Servers
For Providers
Reasoning Tokens
Usage Accounting
Community
Frameworks
Discord
On this page
Price-Based Load Balancing (Default Strategy)
Provider Sorting
Nitro Shortcut
Floor Price Shortcut
Ordering Specific Providers
Example: Specifying providers with fallbacks
Example: Specifying providers with fallbacks disabled
Targeting Specific Provider Endpoints
Requiring Providers to Support All Parameters
Example: Excluding providers that don’t support JSON formatting
Requiring Providers to Comply with Data Policies
Example: Excluding providers that don’t comply with data policies
Disabling Fallbacks
Allowing Only Specific Providers
Example: Allowing Azure for a request calling GPT-4 Omni
Ignoring Providers
Example: Ignoring DeepInfra for a request calling Llama 3.3 70b
Quantization
Quantization Levels
Example: Requesting FP8 Quantization
Max Price
Terms of Service
JSON Schema for Provider Preferences
Features
Provider Routing


Copy page

Route requests to the best provider

OpenRouter routes requests to the best available providers for your model. By default, requests are load balanced across the top providers to maximize uptime.

You can customize how your requests are routed using the provider object in the request body for Chat Completions and Completions.

For a complete list of valid provider names to use in the API, see the full provider schema.

The provider object can contain the following fields:

Field	Type	Default	Description
order	string[]	-	List of provider slugs to try in order (e.g. ["anthropic", "openai"]). Learn more
allow_fallbacks	boolean	true	Whether to allow backup providers when the primary is unavailable. Learn more
require_parameters	boolean	false	Only use providers that support all parameters in your request. Learn more
data_collection	”allow” | “deny"	"allow”	Control whether to use providers that may store data. Learn more
only	string[]	-	List of provider slugs to allow for this request. Learn more
ignore	string[]	-	List of provider slugs to skip for this request. Learn more
quantizations	string[]	-	List of quantization levels to filter by (e.g. ["int4", "int8"]). Learn more
sort	string	-	Sort providers by price or throughput. (e.g. "price" or "throughput"). Learn more
max_price	object	-	The maximum pricing you want to pay for this request. Learn more
Price-Based Load Balancing (Default Strategy)
For each model in your request, OpenRouter’s default behavior is to load balance requests across providers, prioritizing price.

If you are more sensitive to throughput than price, you can use the sort field to explicitly prioritize throughput.

When you send a request with tools or tool_choice, OpenRouter will only route to providers that support tool use. Similarly, if you set a max_tokens, then OpenRouter will only route to providers that support a response of that length.

Here is OpenRouter’s default load balancing strategy:

Prioritize providers that have not seen significant outages in the last 30 seconds.
For the stable providers, look at the lowest-cost candidates and select one weighted by inverse square of the price (example below).
Use the remaining providers as fallbacks.
A Load Balancing Example
If Provider A costs $1 per million tokens, Provider B costs $2, and Provider C costs $3, and Provider B recently saw a few outages.

Your request is routed to Provider A. Provider A is 9x more likely to be first routed to Provider A than Provider C because 
(
1
/
3
2
=
1
/
9
)
(1/3 
2
 =1/9) (inverse square of the price).
If Provider A fails, then Provider C will be tried next.
If Provider C also fails, Provider B will be tried last.
If you have sort or order set in your provider preferences, load balancing will be disabled.

Provider Sorting
As described above, OpenRouter load balances based on price, while taking uptime into account.

If you instead want to explicitly prioritize a particular provider attribute, you can include the sort field in the provider preferences. Load balancing will be disabled, and the router will try providers in order.

The three sort options are:

"price": prioritize lowest price
"throughput": prioritize highest throughput
"latency": prioritize lowest latency

TypeScript Example with Fallbacks Enabled

Python Example with Fallbacks Enabled

fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer <OPENROUTER_API_KEY>',
    'HTTP-Referer': '<YOUR_SITE_URL>', // Optional. Site URL for rankings on openrouter.ai.
    'X-Title': '<YOUR_SITE_NAME>', // Optional. Site title for rankings on openrouter.ai.
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    'model': 'meta-llama/llama-3.1-70b-instruct',
    'messages': [
      {
        'role': 'user',
        'content': 'Hello'
      }
    ],
    'provider': {
      'sort': 'throughput'
    }
  }),
});
To always prioritize low prices, and not apply any load balancing, set sort to "price".

To always prioritize low latency, and not apply any load balancing, set sort to "latency".

Nitro Shortcut
You can append :nitro to any model slug as a shortcut to sort by throughput. This is exactly equivalent to setting provider.sort to "throughput".


TypeScript Example using Nitro shortcut

Python Example using Nitro shortcut

fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer <OPENROUTER_API_KEY>',
    'HTTP-Referer': '<YOUR_SITE_URL>', // Optional. Site URL for rankings on openrouter.ai.
    'X-Title': '<YOUR_SITE_NAME>', // Optional. Site title for rankings on openrouter.ai.
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    'model': 'meta-llama/llama-3.1-70b-instruct:nitro',
    'messages': [
      {
        'role': 'user',
        'content': 'Hello'
      }
    ]
  }),
});
Floor Price Shortcut
You can append :floor to any model slug as a shortcut to sort by price. This is exactly equivalent to setting provider.sort to "price".


TypeScript Example using Floor shortcut

Python Example using Floor shortcut

fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer <OPENROUTER_API_KEY>',
    'HTTP-Referer': '<YOUR_SITE_URL>', // Optional. Site URL for rankings on openrouter.ai.
    'X-Title': '<YOUR_SITE_NAME>', // Optional. Site title for rankings on openrouter.ai.
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    'model': 'meta-llama/llama-3.1-70b-instruct:floor',
    'messages': [
      {
        'role': 'user',
        'content': 'Hello'
      }
    ]
  }),
});
Ordering Specific Providers
You can set the providers that OpenRouter will prioritize for your request using the order field.

Field	Type	Default	Description
order	string[]	-	List of provider slugs to try in order (e.g. ["anthropic", "openai"]).
The router will prioritize providers in this list, and in this order, for the model you’re using. If you don’t set this field, the router will load balance across the top providers to maximize uptime.

You can use the copy button next to provider names on model pages to get the exact provider slug, including any variants like “/turbo”. See Targeting Specific Provider Endpoints for details.

OpenRouter will try them one at a time and proceed to other providers if none are operational. If you don’t want to allow any other providers, you should disable fallbacks as well.

Example: Specifying providers with fallbacks
This example skips over OpenAI (which doesn’t host Mixtral), tries Together, and then falls back to the normal list of providers on OpenRouter:


TypeScript Example with Fallbacks Enabled

Python Example with Fallbacks Enabled

fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer <OPENROUTER_API_KEY>',
    'HTTP-Referer': '<YOUR_SITE_URL>', // Optional. Site URL for rankings on openrouter.ai.
    'X-Title': '<YOUR_SITE_NAME>', // Optional. Site title for rankings on openrouter.ai.
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    'model': 'mistralai/mixtral-8x7b-instruct',
    'messages': [
      {
        'role': 'user',
        'content': 'Hello'
      }
    ],
    'provider': {
      'order': [
        'openai',
        'together'
      ]
    }
  }),
});
Example: Specifying providers with fallbacks disabled
Here’s an example with allow_fallbacks set to false that skips over OpenAI (which doesn’t host Mixtral), tries Together, and then fails if Together fails:


TypeScript Example with Fallbacks Disabled

Python Example with Fallbacks Disabled

fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer <OPENROUTER_API_KEY>',
    'HTTP-Referer': '<YOUR_SITE_URL>', // Optional. Site URL for rankings on openrouter.ai.
    'X-Title': '<YOUR_SITE_NAME>', // Optional. Site title for rankings on openrouter.ai.
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    'model': 'mistralai/mixtral-8x7b-instruct',
    'messages': [
      {
        'role': 'user',
        'content': 'Hello'
      }
    ],
    'provider': {
      'order': [
        'openai',
        'together'
      ],
      'allow_fallbacks': false
    }
  }),
});
Targeting Specific Provider Endpoints
Each provider on OpenRouter may host multiple endpoints for the same model, such as a default endpoint and a specialized “turbo” endpoint. To target a specific endpoint, you can use the copy button next to the provider name on the model detail page to obtain the exact provider slug.

For example, DeepInfra offers DeepSeek R1 through multiple endpoints:

Default endpoint with slug deepinfra
Turbo endpoint with slug deepinfra/turbo
By copying the exact provider slug and using it in your request’s order array, you can ensure your request is routed to the specific endpoint you want:


TypeScript Example targeting DeepInfra Turbo endpoint

Python Example targeting DeepInfra Turbo endpoint

fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer <OPENROUTER_API_KEY>',
    'HTTP-Referer': '<YOUR_SITE_URL>', // Optional. Site URL for rankings on openrouter.ai.
    'X-Title': '<YOUR_SITE_NAME>', // Optional. Site title for rankings on openrouter.ai.
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    'model': 'deepseek/deepseek-r1',
    'messages': [
      {
        'role': 'user',
        'content': 'Hello'
      }
    ],
    'provider': {
      'order': [
        'deepinfra/turbo'
      ],
      'allow_fallbacks': false
    }
  }),
});
This approach is especially useful when you want to consistently use a specific variant of a model from a particular provider.

Requiring Providers to Support All Parameters
You can restrict requests only to providers that support all parameters in your request using the require_parameters field.

Field	Type	Default	Description
require_parameters	boolean	false	Only use providers that support all parameters in your request.
With the default routing strategy, providers that don’t support all the LLM parameters specified in your request can still receive the request, but will ignore unknown parameters. When you set require_parameters to true, the request won’t even be routed to that provider.

Example: Excluding providers that don’t support JSON formatting
For example, to only use providers that support JSON formatting:


TypeScript

Python

fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer <OPENROUTER_API_KEY>',
    'HTTP-Referer': '<YOUR_SITE_URL>', // Optional. Site URL for rankings on openrouter.ai.
    'X-Title': '<YOUR_SITE_NAME>', // Optional. Site title for rankings on openrouter.ai.
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    'messages': [
      {
        'role': 'user',
        'content': 'Hello'
      }
    ],
    'provider': {
      'require_parameters': true
    },
    'response_format': {
      'type': 'json_object'
    }
  }),
});
Requiring Providers to Comply with Data Policies
You can restrict requests only to providers that comply with your data policies using the data_collection field.

Field	Type	Default	Description
data_collection	”allow” | “deny"	"allow”	Control whether to use providers that may store data.
allow: (default) allow providers which store user data non-transiently and may train on it
deny: use only providers which do not collect user data
Some model providers may log prompts, so we display them with a Data Policy tag on model pages. This is not a definitive source of third party data policies, but represents our best knowledge.

Account-Wide Data Policy Filtering
This is also available as an account-wide setting in your privacy settings. You can disable third party model providers that store inputs for training.

Example: Excluding providers that don’t comply with data policies
To exclude providers that don’t comply with your data policies, set data_collection to deny:


TypeScript

Python

fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer <OPENROUTER_API_KEY>',
    'HTTP-Referer': '<YOUR_SITE_URL>', // Optional. Site URL for rankings on openrouter.ai.
    'X-Title': '<YOUR_SITE_NAME>', // Optional. Site title for rankings on openrouter.ai.
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    'messages': [
      {
        'role': 'user',
        'content': 'Hello'
      }
    ],
    'provider': {
      'data_collection': 'deny'
    }
  }),
});
Disabling Fallbacks
To guarantee that your request is only served by the top (lowest-cost) provider, you can disable fallbacks.

This is combined with the order field from Ordering Specific Providers to restrict the providers that OpenRouter will prioritize to just your chosen list.


TypeScript

Python

fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer <OPENROUTER_API_KEY>',
    'HTTP-Referer': '<YOUR_SITE_URL>', // Optional. Site URL for rankings on openrouter.ai.
    'X-Title': '<YOUR_SITE_NAME>', // Optional. Site title for rankings on openrouter.ai.
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    'messages': [
      {
        'role': 'user',
        'content': 'Hello'
      }
    ],
    'provider': {
      'allow_fallbacks': false
    }
  }),
});
Allowing Only Specific Providers
You can allow only specific providers for a request by setting the only field in the provider object.

Field	Type	Default	Description
only	string[]	-	List of provider slugs to allow for this request.
Only allowing some providers may significantly reduce fallback options and limit request recovery.

Account-Wide Allowed Providers
You can allow providers for all account requests by configuring your preferences. This configuration applies to all API requests and chatroom messages.

Note that when you allow providers for a specific request, the list of allowed providers is merged with your account-wide allowed providers.

Example: Allowing Azure for a request calling GPT-4 Omni
Here’s an example that will only use Azure for a request calling GPT-4 Omni:


TypeScript

Python

fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer <OPENROUTER_API_KEY>',
    'HTTP-Referer': '<YOUR_SITE_URL>', // Optional. Site URL for rankings on openrouter.ai.
    'X-Title': '<YOUR_SITE_NAME>', // Optional. Site title for rankings on openrouter.ai.
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    'model': 'openai/gpt-4o',
    'messages': [
      {
        'role': 'user',
        'content': 'Hello'
      }
    ],
    'provider': {
      'only': [
        'azure'
      ]
    }
  }),
});
Ignoring Providers
You can ignore providers for a request by setting the ignore field in the provider object.

Field	Type	Default	Description
ignore	string[]	-	List of provider slugs to skip for this request.
Ignoring multiple providers may significantly reduce fallback options and limit request recovery.

Account-Wide Ignored Providers
You can ignore providers for all account requests by configuring your preferences. This configuration applies to all API requests and chatroom messages.

Note that when you ignore providers for a specific request, the list of ignored providers is merged with your account-wide ignored providers.

Example: Ignoring DeepInfra for a request calling Llama 3.3 70b
Here’s an example that will ignore DeepInfra for a request calling Llama 3.3 70b:


TypeScript

Python

fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer <OPENROUTER_API_KEY>',
    'HTTP-Referer': '<YOUR_SITE_URL>', // Optional. Site URL for rankings on openrouter.ai.
    'X-Title': '<YOUR_SITE_NAME>', // Optional. Site title for rankings on openrouter.ai.
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    'model': 'meta-llama/llama-3.3-70b-instruct',
    'messages': [
      {
        'role': 'user',
        'content': 'Hello'
      }
    ],
    'provider': {
      'ignore': [
        'deepinfra'
      ]
    }
  }),
});
Quantization
Quantization reduces model size and computational requirements while aiming to preserve performance. Most LLMs today use FP16 or BF16 for training and inference, cutting memory requirements in half compared to FP32. Some optimizations use FP8 or quantization to reduce size further (e.g., INT8, INT4).

Field	Type	Default	Description
quantizations	string[]	-	List of quantization levels to filter by (e.g. ["int4", "int8"]). Learn more
Quantized models may exhibit degraded performance for certain prompts, depending on the method used.

Providers can support various quantization levels for open-weight models.

Quantization Levels
By default, requests are load-balanced across all available providers, ordered by price. To filter providers by quantization level, specify the quantizations field in the provider parameter with the following values:

int4: Integer (4 bit)
int8: Integer (8 bit)
fp4: Floating point (4 bit)
fp6: Floating point (6 bit)
fp8: Floating point (8 bit)
fp16: Floating point (16 bit)
bf16: Brain floating point (16 bit)
fp32: Floating point (32 bit)
unknown: Unknown
Example: Requesting FP8 Quantization
Here’s an example that will only use providers that support FP8 quantization:


TypeScript

Python

fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer <OPENROUTER_API_KEY>',
    'HTTP-Referer': '<YOUR_SITE_URL>', // Optional. Site URL for rankings on openrouter.ai.
    'X-Title': '<YOUR_SITE_NAME>', // Optional. Site title for rankings on openrouter.ai.
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    'model': 'meta-llama/llama-3.1-8b-instruct',
    'messages': [
      {
        'role': 'user',
        'content': 'Hello'
      }
    ],
    'provider': {
      'quantizations': [
        'fp8'
      ]
    }
  }),
});
Max Price
To filter providers by price, specify the max_price field in the provider parameter with a JSON object specifying the highest provider pricing you will accept.

For example, the value {"prompt": 1, "completion": 2} will route to any provider with a price of <= $1/m prompt tokens, and <= $2/m completion tokens or less.

Some providers support per request pricing, in which case you can use the request attribute of max_price. Lastly, image is also available, which specifies the max price per image you will accept.

Practically, this field is often combined with a provider sort to express, for example, “Use the provider with the highest throughput, as long as it doesn’t cost more than $x/m tokens.”

Terms of Service
You can view the terms of service for each provider below. You may not violate the terms of service or policies of third-party providers that power the models on OpenRouter.

AI21: https://www.ai21.com/terms-of-service/
AionLabs: https://www.aionlabs.ai/terms/
Alibaba: https://www.alibabacloud.com/help/en/legal/latest/alibaba-cloud-international-website-product-terms-of-service-v-3-8-0
Amazon Bedrock: https://aws.amazon.com/service-terms/
Anthropic: https://www.anthropic.com/legal/commercial-terms
AtlasCloud: https://www.atlascloud.ai/privacy
Atoma: https://atoma.network/terms_of_service
Avian.io: https://avian.io/terms
Azure: https://www.microsoft.com/en-us/legal/terms-of-use?oneroute=true
Baseten: https://www.baseten.co/terms-and-conditions
CentML: https://centml.ai/terms-of-service/
Cerebras: https://www.cerebras.ai/terms-of-service
Chutes: https://chutes.ai/tos
Cloudflare: https://www.cloudflare.com/service-specific-terms-developer-platform/#developer-platform-terms
Cohere: https://cohere.com/terms-of-use
CrofAI: https://ai.nahcrof.com/privacy
Crusoe: https://legal.crusoe.ai/open-router#managed-inference-tos-open-router
DeepInfra: https://deepinfra.com/terms
DeepSeek: https://chat.deepseek.com/downloads/DeepSeek%20Terms%20of%20Use.html
Enfer: https://enfer.ai/privacy-policy
Featherless: https://featherless.ai/terms
Fireworks: https://fireworks.ai/terms-of-service
Friendli: https://friendli.ai/terms-of-service
GMICloud: https://docs.gmicloud.ai/privacy
Google Vertex: https://cloud.google.com/terms/
Google AI Studio: https://cloud.google.com/terms/
Groq: https://groq.com/terms-of-use/
Hyperbolic: https://hyperbolic.xyz/terms
Inception: https://www.inceptionlabs.ai/terms
inference.net: https://inference.net/terms-of-service
Infermatic: https://infermatic.ai/terms-and-conditions/
Inflection: https://developers.inflection.ai/tos
InoCloud: https://inocloud.com/terms
kluster.ai: https://www.kluster.ai/terms-of-use
Lambda: https://lambda.ai/legal/terms-of-service
Liquid: https://www.liquid.ai/terms-conditions
Mancer (private): https://mancer.tech/terms
Meta: https://llama.developer.meta.com/legal/terms-of-service
Minimax: https://www.minimax.io/platform/protocol/terms-of-service
Mistral: https://mistral.ai/terms/#terms-of-use
nCompass: https://ncompass.tech/terms
Nebius AI Studio: https://docs.nebius.com/legal/studio/terms-of-use/
NextBit: https://www.nextbit256.com/docs/terms-of-service
Nineteen: https://nineteen.ai/tos
NovitaAI: https://novita.ai/legal/terms-of-service
OpenAI: https://openai.com/policies/row-terms-of-use/
OpenInference: https://www.openinference.xyz/terms
Parasail: https://www.parasail.io/legal/terms
Perplexity: https://www.perplexity.ai/hub/legal/perplexity-api-terms-of-service
Phala: https://red-pill.ai/terms
SambaNova: https://sambanova.ai/terms-and-conditions
Targon: https://targon.com/terms
Together: https://www.together.ai/terms-of-service
Ubicloud: https://www.ubicloud.com/docs/about/terms-of-service
Venice: https://venice.ai/legal/tos
xAI: https://x.ai/legal/terms-of-service
JSON Schema for Provider Preferences
For a complete list of options, see this JSON schema:

Provider Preferences Schema

{
    "$ref": "#/definitions/Provider Preferences Schema",
    "definitions": {
      "Provider Preferences Schema": {
        "type": "object",
        "properties": {
          "allow_fallbacks": {
            "type": [
              "boolean",
              "null"
            ],
            "description": "Whether to allow backup providers to serve requests\n- true: (default) when the primary provider (or your custom providers in \"order\") is unavailable, use the next best provider.\n- false: use only the primary/custom provider, and return the upstream error if it's unavailable.\n"
          },
          "require_parameters": {
            "type": [
              "boolean",
              "null"
            ],
            "description": "Whether to filter providers to only those that support the parameters you've provided. If this setting is omitted or set to false, then providers will receive only the parameters they support, and ignore the rest."
          },
          "data_collection": {
            "anyOf": [
              {
                "type": "string",
                "enum": [
                  "deny",
                  "allow"
                ]
              },
              {
                "type": "null"
              }
            ],
            "description": "Data collection setting. If no available model provider meets the requirement, your request will return an error.\n- allow: (default) allow providers which store user data non-transiently and may train on it\n- deny: use only providers which do not collect user data.\n"
          },
          "order": {
            "anyOf": [
              {
                "type": "array",
                "items": {
                  "anyOf": [
                    {
                      "type": "string",
                      "enum": [
                        "AnyScale",
                        "HuggingFace",
                        "Hyperbolic 2",
                        "Lepton",
                        "Lynn 2",
                        "Lynn",
                        "Mancer",
                        "Modal",
                        "OctoAI",
                        "Recursal",
                        "Reflection",
                        "Replicate",
                        "SambaNova 2",
                        "SF Compute",
                        "Together 2",
                        "01.AI",
                        "AI21",
                        "AionLabs",
                        "Alibaba",
                        "Amazon Bedrock",
                        "Anthropic",
                        "AtlasCloud",
                        "Atoma",
                        "Avian",
                        "Azure",
                        "BaseTen",
                        "Cent-ML",
                        "Cerebras",
                        "Chutes",
                        "Cloudflare",
                        "Cohere",
                        "CrofAI",
                        "Crusoe",
                        "DeepInfra",
                        "DeepSeek",
                        "Enfer",
                        "Featherless",
                        "Fireworks",
                        "Friendli",
                        "GMICloud",
                        "Google",
                        "Google AI Studio",
                        "Groq",
                        "Hyperbolic",
                        "Inception",
                        "InferenceNet",
                        "Infermatic",
                        "Inflection",
                        "InoCloud",
                        "Kluster",
                        "Lambda",
                        "Liquid",
                        "Mancer 2",
                        "Meta",
                        "Minimax",
                        "Mistral",
                        "NCompass",
                        "Nebius",
                        "NextBit",
                        "Nineteen",
                        "Novita",
                        "OpenAI",
                        "OpenInference",
                        "Parasail",
                        "Perplexity",
                        "Phala",
                        "SambaNova",
                        "Stealth",
                        "Targon",
                        "Together",
                        "Ubicloud",
                        "Venice",
                        "xAI"
                      ]
                    },
                    {
                      "type": "string"
                    }
                  ]
                }
              },
              {
                "type": "null"
              }
            ],
            "description": "An ordered list of provider slugs. The router will attempt to use the first provider in the subset of this list that supports your requested model, and fall back to the next if it is unavailable. If no providers are available, the request will fail with an error message."
          },
          "only": {
            "anyOf": [
              {
                "$ref": "#/definitions/Provider Preferences Schema/properties/order/anyOf/0"
              },
              {
                "type": "null"
              }
            ],
            "description": "List of provider slugs to allow. If provided, this list is merged with your account-wide allowed provider settings for this request."
          },
          "ignore": {
            "anyOf": [
              {
                "$ref": "#/definitions/Provider Preferences Schema/properties/order/anyOf/0"
              },
              {
                "type": "null"
              }
            ],
            "description": "List of provider slugs to ignore. If provided, this list is merged with your account-wide ignored provider settings for this request."
          },
          "quantizations": {
            "anyOf": [
              {
                "type": "array",
                "items": {
                  "type": "string",
                  "enum": [
                    "int4",
                    "int8",
                    "fp4",
                    "fp6",
                    "fp8",
                    "fp16",
                    "bf16",
                    "fp32",
                    "unknown"
                  ]
                }
              },
              {
                "type": "null"
              }
            ],
            "description": "A list of quantization levels to filter the provider by."
          },
          "sort": {
            "anyOf": [
              {
                "type": "string",
                "enum": [
                  "price",
                  "throughput",
                  "latency"
                ]
              },
              {
                "type": "null"
              }
            ],
            "description": "The sorting strategy to use for this request, if \"order\" is not specified. When set, no load balancing is performed."
          },
          "max_price": {
            "type": "object",
            "properties": {
              "prompt": {
                "anyOf": [
                  {
                    "type": "number"
                  },
                  {
                    "type": "string"
                  },
                  {}
                ]
              },
              "completion": {
                "$ref": "#/definitions/Provider Preferences Schema/properties/max_price/properties/prompt"
              },
              "image": {
                "$ref": "#/definitions/Provider Preferences Schema/properties/max_price/properties/prompt"
              },
              "request": {
                "$ref": "#/definitions/Provider Preferences Schema/properties/max_price/properties/prompt"
              }
            },
            "additionalProperties": false,
            "description": "The object specifying the maximum price you want to pay for this request. USD price per million tokens, for prompt and completion."
          },
          "experimental": {
            "anyOf": [
              {
                "type": "object",
                "properties": {
                  "force_chat_completions": {
                    "type": [
                      "boolean",
                      "null"
                    ]
                  }
                },
                "additionalProperties": false
              },
              {
                "type": "null"
              }
            ]
          }
        },
        "additionalProperties": false
      }
    },
    "$schema": "http://json-schema.org/draft-07/schema#"
  }
Was this page helpful?
Yes
No
Previous
Prompt Caching

Cache prompt messages

Next
Built with

Logo
Search or ask AI a question
/
API
Models
Chat
Ranking
Login

Overview
Quickstart
FAQ
Principles
Models
Features
Privacy and Logging
Model Routing
Provider Routing
Prompt Caching
Structured Outputs
Tool Calling
Images & PDFs
Message Transforms
Uptime Optimization
Web Search
Zero Completion Insurance
Provisioning API Keys
API Reference
Overview
Streaming
Limits
Authentication
Parameters
Errors
POST
Completion
POST
Chat completion
GET
Get a generation
GET
List available models
GET
List endpoints for a model
GET
Get credits
POST
Create a Coinbase charge

Authentication

API Keys
Use Cases
BYOK
Crypto API
OAuth PKCE
MCP Servers
For Providers
Reasoning Tokens
Usage Accounting
Community
Frameworks
Discord
On this page
Tool Calling Example
Define the Tool
Tool use and tool results
A Simple Agentic Loop
Features
Tool & Function Calling


Copy page

Use tools in your prompts

Tool calls (also known as function calls) give an LLM access to external tools. The LLM does not call the tools directly. Instead, it suggests the tool to call. The user then calls the tool separately and provides the results back to the LLM. Finally, the LLM formats the response into an answer to the user’s original question.

OpenRouter standardizes the tool calling interface across models and providers.

For a primer on how tool calling works in the OpenAI SDK, please see this article, or if you prefer to learn from a full end-to-end example, keep reading.

Tool Calling Example
Here is Python code that gives LLMs the ability to call an external API — in this case Project Gutenberg, to search for books.

First, let’s do some basic setup:


Python

TypeScript

import json, requests
from openai import OpenAI
OPENROUTER_API_KEY = f"<OPENROUTER_API_KEY>"
# You can use any model that supports tool calling
MODEL = "google/gemini-2.0-flash-001"
openai_client = OpenAI(
  base_url="https://openrouter.ai/api/v1",
  api_key=OPENROUTER_API_KEY,
)
task = "What are the titles of some James Joyce books?"
messages = [
  {
    "role": "system",
    "content": "You are a helpful assistant."
  },
  {
    "role": "user",
    "content": task,
  }
]
Define the Tool
Next, we define the tool that we want to call. Remember, the tool is going to get requested by the LLM, but the code we are writing here is ultimately responsible for executing the call and returning the results to the LLM.


Python

TypeScript

def search_gutenberg_books(search_terms):
    search_query = " ".join(search_terms)
    url = "https://gutendex.com/books"
    response = requests.get(url, params={"search": search_query})
    simplified_results = []
    for book in response.json().get("results", []):
        simplified_results.append({
            "id": book.get("id"),
            "title": book.get("title"),
            "authors": book.get("authors")
        })
    return simplified_results
tools = [
  {
    "type": "function",
    "function": {
      "name": "search_gutenberg_books",
      "description": "Search for books in the Project Gutenberg library based on specified search terms",
      "parameters": {
        "type": "object",
        "properties": {
          "search_terms": {
            "type": "array",
            "items": {
              "type": "string"
            },
            "description": "List of search terms to find books in the Gutenberg library (e.g. ['dickens', 'great'] to search for books by Dickens with 'great' in the title)"
          }
        },
        "required": ["search_terms"]
      }
    }
  }
]
TOOL_MAPPING = {
    "search_gutenberg_books": search_gutenberg_books
}
Note that the “tool” is just a normal function. We then write a JSON “spec” compatible with the OpenAI function calling parameter. We’ll pass that spec to the LLM so that it knows this tool is available and how to use it. It will request the tool when needed, along with any arguments. We’ll then marshal the tool call locally, make the function call, and return the results to the LLM.

Tool use and tool results
Let’s make the first OpenRouter API call to the model:


Python

TypeScript

request_1 = {
    "model": google/gemini-2.0-flash-001,
    "tools": tools,
    "messages": messages
}
response_1 = openai_client.chat.completions.create(**request_1).message
The LLM responds with a finish reason of tool_calls, and a tool_calls array. In a generic LLM response-handler, you would want to check the finish reason before processing tool calls, but here we will assume it’s the case. Let’s keep going, by processing the tool call:


Python

TypeScript

# Append the response to the messages array so the LLM has the full context
# It's easy to forget this step!
messages.append(response_1)
# Now we process the requested tool calls, and use our book lookup tool
for tool_call in response_1.tool_calls:
    '''
    In this case we only provided one tool, so we know what function to call.
    When providing multiple tools, you can inspect `tool_call.function.name`
    to figure out what function you need to call locally.
    '''
    tool_name = tool_call.function.name
    tool_args = json.loads(tool_call.function.arguments)
    tool_response = TOOL_MAPPING[tool_name](**tool_args)
    messages.append({
      "role": "tool",
      "tool_call_id": tool_call.id,
      "name": tool_name,
      "content": json.dumps(tool_response),
    })
The messages array now has:

Our original request
The LLM’s response (containing a tool call request)
The result of the tool call (a json object returned from the Project Gutenberg API)
Now, we can make a second OpenRouter API call, and hopefully get our result!


Python

TypeScript

request_2 = {
  "model": MODEL,
  "messages": messages,
  "tools": tools
}
response_2 = openai_client.chat.completions.create(**request_2)
print(response_2.choices[0].message.content)
The output will be something like:

Here are some books by James Joyce:
*   *Ulysses*
*   *Dubliners*
*   *A Portrait of the Artist as a Young Man*
*   *Chamber Music*
*   *Exiles: A Play in Three Acts*

We did it! We’ve successfully used a tool in a prompt.

A Simple Agentic Loop
In the example above, the calls are made explicitly and sequentially. To handle a wide variety of user inputs and tool calls, you can use an agentic loop.

Here’s an example of a simple agentic loop (using the same tools and initial messages as above):


Python

TypeScript

def call_llm(msgs):
    resp = openai_client.chat.completions.create(
        model=google/gemini-2.0-flash-001,
        tools=tools,
        messages=msgs
    )
    msgs.append(resp.choices[0].message.dict())
    return resp
def get_tool_response(response):
    tool_call = response.choices[0].message.tool_calls[0]
    tool_name = tool_call.function.name
    tool_args = json.loads(tool_call.function.arguments)
    # Look up the correct tool locally, and call it with the provided arguments
    # Other tools can be added without changing the agentic loop
    tool_result = TOOL_MAPPING[tool_name](**tool_args)
    return {
        "role": "tool",
        "tool_call_id": tool_call.id,
        "name": tool_name,
        "content": tool_result,
    }
while True:
    resp = call_llm(_messages)
    if resp.choices[0].message.tool_calls is not None:
        messages.append(get_tool_response(resp))
    else:
        break
print(messages[-1]['content'])
Was this page helpful?
Yes
No
Previous
Images & PDFs

How to send images and PDFs to OpenRouter

Next
Built with
Tool & Function Calling | Use Tools with OpenRouter | OpenRouter | Documentation
Logo
Search or ask AI a question
/
API
Models
Chat
Ranking
Login

Overview
Quickstart
FAQ
Principles
Models
Features
Privacy and Logging
Model Routing
Provider Routing
Prompt Caching
Structured Outputs
Tool Calling
Images & PDFs
Message Transforms
Uptime Optimization
Web Search
Zero Completion Insurance
Provisioning API Keys
API Reference
Overview
Streaming
Limits
Authentication
Parameters
Errors
POST
Completion
POST
Chat completion
GET
Get a generation
GET
List available models
GET
List endpoints for a model
GET
Get credits
POST
Create a Coinbase charge

Authentication

API Keys
Use Cases
BYOK
Crypto API
OAuth PKCE
MCP Servers
For Providers
Reasoning Tokens
Usage Accounting
Community
Frameworks
Discord
On this page
Tool Calling Example
Define the Tool
Tool use and tool results
A Simple Agentic Loop
Features
Tool & Function Calling


Copy page

Use tools in your prompts

Tool calls (also known as function calls) give an LLM access to external tools. The LLM does not call the tools directly. Instead, it suggests the tool to call. The user then calls the tool separately and provides the results back to the LLM. Finally, the LLM formats the response into an answer to the user’s original question.

OpenRouter standardizes the tool calling interface across models and providers.

For a primer on how tool calling works in the OpenAI SDK, please see this article, or if you prefer to learn from a full end-to-end example, keep reading.

Tool Calling Example
Here is Python code that gives LLMs the ability to call an external API — in this case Project Gutenberg, to search for books.

First, let’s do some basic setup:


Python

TypeScript

const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    Authorization: `Bearer <OPENROUTER_API_KEY>`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'google/gemini-2.0-flash-001',
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      {
        role: 'user',
        content: 'What are the titles of some James Joyce books?',
      },
    ],
  }),
});
Define the Tool
Next, we define the tool that we want to call. Remember, the tool is going to get requested by the LLM, but the code we are writing here is ultimately responsible for executing the call and returning the results to the LLM.


Python

TypeScript

async function searchGutenbergBooks(searchTerms: string[]): Promise<Book[]> {
  const searchQuery = searchTerms.join(' ');
  const url = 'https://gutendex.com/books';
  const response = await fetch(`${url}?search=${searchQuery}`);
  const data = await response.json();
  return data.results.map((book: any) => ({
    id: book.id,
    title: book.title,
    authors: book.authors,
  }));
}
const tools = [
  {
    type: 'function',
    function: {
      name: 'searchGutenbergBooks',
      description:
        'Search for books in the Project Gutenberg library based on specified search terms',
      parameters: {
        type: 'object',
        properties: {
          search_terms: {
            type: 'array',
            items: {
              type: 'string',
            },
            description:
              "List of search terms to find books in the Gutenberg library (e.g. ['dickens', 'great'] to search for books by Dickens with 'great' in the title)",
          },
        },
        required: ['search_terms'],
      },
    },
  },
];
const TOOL_MAPPING = {
  searchGutenbergBooks,
};
Note that the “tool” is just a normal function. We then write a JSON “spec” compatible with the OpenAI function calling parameter. We’ll pass that spec to the LLM so that it knows this tool is available and how to use it. It will request the tool when needed, along with any arguments. We’ll then marshal the tool call locally, make the function call, and return the results to the LLM.

Tool use and tool results
Let’s make the first OpenRouter API call to the model:


Python

TypeScript

const request_1 = await fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    Authorization: `Bearer <OPENROUTER_API_KEY>`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'google/gemini-2.0-flash-001',
    tools,
    messages,
  }),
});
const data = await request_1.json();
const response_1 = data.choices[0].message;
The LLM responds with a finish reason of tool_calls, and a tool_calls array. In a generic LLM response-handler, you would want to check the finish reason before processing tool calls, but here we will assume it’s the case. Let’s keep going, by processing the tool call:


Python

TypeScript

// Append the response to the messages array so the LLM has the full context
// It's easy to forget this step!
messages.push(response_1);
// Now we process the requested tool calls, and use our book lookup tool
for (const toolCall of response_1.tool_calls) {
  const toolName = toolCall.function.name;
  const { search_params } = JSON.parse(toolCall.function.arguments);
  const toolResponse = await TOOL_MAPPING[toolName](search_params);
  messages.push({
    role: 'tool',
    toolCallId: toolCall.id,
    name: toolName,
    content: JSON.stringify(toolResponse),
  });
}
The messages array now has:

Our original request
The LLM’s response (containing a tool call request)
The result of the tool call (a json object returned from the Project Gutenberg API)
Now, we can make a second OpenRouter API call, and hopefully get our result!


Python

TypeScript

const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    Authorization: `Bearer <OPENROUTER_API_KEY>`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'google/gemini-2.0-flash-001',
    messages,
    tools,
  }),
});
const data = await response.json();
console.log(data.choices[0].message.content);
The output will be something like:

Here are some books by James Joyce:
*   *Ulysses*
*   *Dubliners*
*   *A Portrait of the Artist as a Young Man*
*   *Chamber Music*
*   *Exiles: A Play in Three Acts*

We did it! We’ve successfully used a tool in a prompt.

A Simple Agentic Loop
In the example above, the calls are made explicitly and sequentially. To handle a wide variety of user inputs and tool calls, you can use an agentic loop.

Here’s an example of a simple agentic loop (using the same tools and initial messages as above):


Python

TypeScript

async function callLLM(messages: Message[]): Promise<Message> {
  const response = await fetch(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer <OPENROUTER_API_KEY>`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-001',
        tools,
        messages,
      }),
    },
  );
  const data = await response.json();
  messages.push(data.choices[0].message);
  return data;
}
async function getToolResponse(response: Message): Promise<Message> {
  const toolCall = response.toolCalls[0];
  const toolName = toolCall.function.name;
  const toolArgs = JSON.parse(toolCall.function.arguments);
  // Look up the correct tool locally, and call it with the provided arguments
  // Other tools can be added without changing the agentic loop
  const toolResult = await TOOL_MAPPING[toolName](toolArgs);
  return {
    role: 'tool',
    toolCallId: toolCall.id,
    name: toolName,
    content: toolResult,
  };
}
while (true) {
  const response = await callLLM(messages);
  if (response.toolCalls) {
    messages.push(await getToolResponse(response));
  } else {
    break;
  }
}
console.log(messages[messages.length - 1].content);
Was this page helpful?
Yes
No
Previous
Images & PDFs

How to send images and PDFs to OpenRouter

Next
Built with
Tool & Function Calling | Use Tools with OpenRouter | OpenRouter | Documentation
Logo
Search or ask AI a question
/
API
Models
Chat
Ranking
Login

Overview
Quickstart
FAQ
Principles
Models
Features
Privacy and Logging
Model Routing
Provider Routing
Prompt Caching
Structured Outputs
Tool Calling
Images & PDFs
Message Transforms
Uptime Optimization
Web Search
Zero Completion Insurance
Provisioning API Keys
API Reference
Overview
Streaming
Limits
Authentication
Parameters
Errors
POST
Completion
POST
Chat completion
GET
Get a generation
GET
List available models
GET
List endpoints for a model
GET
Get credits
POST
Create a Coinbase charge

Authentication

API Keys
Use Cases
BYOK
Crypto API
OAuth PKCE
MCP Servers
For Providers
Reasoning Tokens
Usage Accounting
Community
Frameworks
Discord
On this page
Auto Router
The models parameter
Using with OpenAI SDK
Features
Model Routing


Copy page

Dynamically route requests to models

OpenRouter provides two options for model routing.

Auto Router
The Auto Router, a special model ID that you can use to choose between selected high-quality models based on your prompt, powered by NotDiamond.

{
  "model": "openrouter/auto",
  ... // Other params
}

The resulting generation will have model set to the model that was used.

The models parameter
The models parameter lets you automatically try other models if the primary model’s providers are down, rate-limited, or refuse to reply due to content moderation.

{
  "models": ["anthropic/claude-3.5-sonnet", "gryphe/mythomax-l2-13b"],
  ... // Other params
}

If the model you selected returns an error, OpenRouter will try to use the fallback model instead. If the fallback model is down or returns an error, OpenRouter will return that error.

By default, any error can trigger the use of a fallback model, including context length validation errors, moderation flags for filtered models, rate-limiting, and downtime.

Requests are priced using the model that was ultimately used, which will be returned in the model attribute of the response body.

Using with OpenAI SDK
To use the models array with the OpenAI SDK, include it in the extra_body parameter. In the example below, gpt-4o will be tried first, and the models array will be tried in order as fallbacks.


TypeScript

Python

import OpenAI from 'openai';
const openrouterClient = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  // API key and headers
});
async function main() {
  // @ts-expect-error
  const completion = await openrouterClient.chat.completions.create({
    model: 'openai/gpt-4o',
    models: ['anthropic/claude-3.5-sonnet', 'gryphe/mythomax-l2-13b'],
    messages: [
      {
        role: 'user',
        content: 'What is the meaning of life?',
      },
    ],
  });
  console.log(completion.choices[0].message);
}
main();
Was this page helpful?
Yes
No
Previous
Provider Routing

Route requests to the best provider

Next
Built with
Model Routing | Dynamic AI Model Selection and Fallback | OpenRouter | Documentation
Logo
Search or ask AI a question
/
API
Models
Chat
Ranking
Login

Overview
Quickstart
FAQ
Principles
Models
Features
Privacy and Logging
Model Routing
Provider Routing
Prompt Caching
Structured Outputs
Tool Calling
Images & PDFs
Message Transforms
Uptime Optimization
Web Search
Zero Completion Insurance
Provisioning API Keys
API Reference
Overview
Streaming
Limits
Authentication
Parameters
Errors
POST
Completion
POST
Chat completion
GET
Get a generation
GET
List available models
GET
List endpoints for a model
GET
Get credits
POST
Create a Coinbase charge

Authentication

API Keys
Use Cases
BYOK
Crypto API
OAuth PKCE
MCP Servers
For Providers
Reasoning Tokens
Usage Accounting
Community
Frameworks
Discord
On this page
Price-Based Load Balancing (Default Strategy)
Provider Sorting
Nitro Shortcut
Floor Price Shortcut
Ordering Specific Providers
Example: Specifying providers with fallbacks
Example: Specifying providers with fallbacks disabled
Targeting Specific Provider Endpoints
Requiring Providers to Support All Parameters
Example: Excluding providers that don’t support JSON formatting
Requiring Providers to Comply with Data Policies
Example: Excluding providers that don’t comply with data policies
Disabling Fallbacks
Allowing Only Specific Providers
Example: Allowing Azure for a request calling GPT-4 Omni
Ignoring Providers
Example: Ignoring DeepInfra for a request calling Llama 3.3 70b
Quantization
Quantization Levels
Example: Requesting FP8 Quantization
Max Price
Terms of Service
JSON Schema for Provider Preferences
Features
Provider Routing


Copy page

Route requests to the best provider

OpenRouter routes requests to the best available providers for your model. By default, requests are load balanced across the top providers to maximize uptime.

You can customize how your requests are routed using the provider object in the request body for Chat Completions and Completions.

For a complete list of valid provider names to use in the API, see the full provider schema.

The provider object can contain the following fields:

Field	Type	Default	Description
order	string[]	-	List of provider slugs to try in order (e.g. ["anthropic", "openai"]). Learn more
allow_fallbacks	boolean	true	Whether to allow backup providers when the primary is unavailable. Learn more
require_parameters	boolean	false	Only use providers that support all parameters in your request. Learn more
data_collection	”allow” | “deny"	"allow”	Control whether to use providers that may store data. Learn more
only	string[]	-	List of provider slugs to allow for this request. Learn more
ignore	string[]	-	List of provider slugs to skip for this request. Learn more
quantizations	string[]	-	List of quantization levels to filter by (e.g. ["int4", "int8"]). Learn more
sort	string	-	Sort providers by price or throughput. (e.g. "price" or "throughput"). Learn more
max_price	object	-	The maximum pricing you want to pay for this request. Learn more
Price-Based Load Balancing (Default Strategy)
For each model in your request, OpenRouter’s default behavior is to load balance requests across providers, prioritizing price.

If you are more sensitive to throughput than price, you can use the sort field to explicitly prioritize throughput.

When you send a request with tools or tool_choice, OpenRouter will only route to providers that support tool use. Similarly, if you set a max_tokens, then OpenRouter will only route to providers that support a response of that length.

Here is OpenRouter’s default load balancing strategy:

Prioritize providers that have not seen significant outages in the last 30 seconds.
For the stable providers, look at the lowest-cost candidates and select one weighted by inverse square of the price (example below).
Use the remaining providers as fallbacks.
A Load Balancing Example
If Provider A costs $1 per million tokens, Provider B costs $2, and Provider C costs $3, and Provider B recently saw a few outages.

Your request is routed to Provider A. Provider A is 9x more likely to be first routed to Provider A than Provider C because 
(
1
/
3
2
=
1
/
9
)
(1/3 
2
 =1/9) (inverse square of the price).
If Provider A fails, then Provider C will be tried next.
If Provider C also fails, Provider B will be tried last.
If you have sort or order set in your provider preferences, load balancing will be disabled.

Provider Sorting
As described above, OpenRouter load balances based on price, while taking uptime into account.

If you instead want to explicitly prioritize a particular provider attribute, you can include the sort field in the provider preferences. Load balancing will be disabled, and the router will try providers in order.

The three sort options are:

"price": prioritize lowest price
"throughput": prioritize highest throughput
"latency": prioritize lowest latency

TypeScript Example with Fallbacks Enabled

Python Example with Fallbacks Enabled

fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer <OPENROUTER_API_KEY>',
    'HTTP-Referer': '<YOUR_SITE_URL>', // Optional. Site URL for rankings on openrouter.ai.
    'X-Title': '<YOUR_SITE_NAME>', // Optional. Site title for rankings on openrouter.ai.
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    'model': 'meta-llama/llama-3.1-70b-instruct',
    'messages': [
      {
        'role': 'user',
        'content': 'Hello'
      }
    ],
    'provider': {
      'sort': 'throughput'
    }
  }),
});
To always prioritize low prices, and not apply any load balancing, set sort to "price".

To always prioritize low latency, and not apply any load balancing, set sort to "latency".

Nitro Shortcut
You can append :nitro to any model slug as a shortcut to sort by throughput. This is exactly equivalent to setting provider.sort to "throughput".


TypeScript Example using Nitro shortcut

Python Example using Nitro shortcut

fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer <OPENROUTER_API_KEY>',
    'HTTP-Referer': '<YOUR_SITE_URL>', // Optional. Site URL for rankings on openrouter.ai.
    'X-Title': '<YOUR_SITE_NAME>', // Optional. Site title for rankings on openrouter.ai.
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    'model': 'meta-llama/llama-3.1-70b-instruct:nitro',
    'messages': [
      {
        'role': 'user',
        'content': 'Hello'
      }
    ]
  }),
});
Floor Price Shortcut
You can append :floor to any model slug as a shortcut to sort by price. This is exactly equivalent to setting provider.sort to "price".


TypeScript Example using Floor shortcut

Python Example using Floor shortcut

fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer <OPENROUTER_API_KEY>',
    'HTTP-Referer': '<YOUR_SITE_URL>', // Optional. Site URL for rankings on openrouter.ai.
    'X-Title': '<YOUR_SITE_NAME>', // Optional. Site title for rankings on openrouter.ai.
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    'model': 'meta-llama/llama-3.1-70b-instruct:floor',
    'messages': [
      {
        'role': 'user',
        'content': 'Hello'
      }
    ]
  }),
});
Ordering Specific Providers
You can set the providers that OpenRouter will prioritize for your request using the order field.

Field	Type	Default	Description
order	string[]	-	List of provider slugs to try in order (e.g. ["anthropic", "openai"]).
The router will prioritize providers in this list, and in this order, for the model you’re using. If you don’t set this field, the router will load balance across the top providers to maximize uptime.

You can use the copy button next to provider names on model pages to get the exact provider slug, including any variants like “/turbo”. See Targeting Specific Provider Endpoints for details.

OpenRouter will try them one at a time and proceed to other providers if none are operational. If you don’t want to allow any other providers, you should disable fallbacks as well.

Example: Specifying providers with fallbacks
This example skips over OpenAI (which doesn’t host Mixtral), tries Together, and then falls back to the normal list of providers on OpenRouter:


TypeScript Example with Fallbacks Enabled

Python Example with Fallbacks Enabled

fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer <OPENROUTER_API_KEY>',
    'HTTP-Referer': '<YOUR_SITE_URL>', // Optional. Site URL for rankings on openrouter.ai.
    'X-Title': '<YOUR_SITE_NAME>', // Optional. Site title for rankings on openrouter.ai.
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    'model': 'mistralai/mixtral-8x7b-instruct',
    'messages': [
      {
        'role': 'user',
        'content': 'Hello'
      }
    ],
    'provider': {
      'order': [
        'openai',
        'together'
      ]
    }
  }),
});
Example: Specifying providers with fallbacks disabled
Here’s an example with allow_fallbacks set to false that skips over OpenAI (which doesn’t host Mixtral), tries Together, and then fails if Together fails:


TypeScript Example with Fallbacks Disabled

Python Example with Fallbacks Disabled

fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer <OPENROUTER_API_KEY>',
    'HTTP-Referer': '<YOUR_SITE_URL>', // Optional. Site URL for rankings on openrouter.ai.
    'X-Title': '<YOUR_SITE_NAME>', // Optional. Site title for rankings on openrouter.ai.
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    'model': 'mistralai/mixtral-8x7b-instruct',
    'messages': [
      {
        'role': 'user',
        'content': 'Hello'
      }
    ],
    'provider': {
      'order': [
        'openai',
        'together'
      ],
      'allow_fallbacks': false
    }
  }),
});
Targeting Specific Provider Endpoints
Each provider on OpenRouter may host multiple endpoints for the same model, such as a default endpoint and a specialized “turbo” endpoint. To target a specific endpoint, you can use the copy button next to the provider name on the model detail page to obtain the exact provider slug.

For example, DeepInfra offers DeepSeek R1 through multiple endpoints:

Default endpoint with slug deepinfra
Turbo endpoint with slug deepinfra/turbo
By copying the exact provider slug and using it in your request’s order array, you can ensure your request is routed to the specific endpoint you want:


TypeScript Example targeting DeepInfra Turbo endpoint

Python Example targeting DeepInfra Turbo endpoint

fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer <OPENROUTER_API_KEY>',
    'HTTP-Referer': '<YOUR_SITE_URL>', // Optional. Site URL for rankings on openrouter.ai.
    'X-Title': '<YOUR_SITE_NAME>', // Optional. Site title for rankings on openrouter.ai.
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    'model': 'deepseek/deepseek-r1',
    'messages': [
      {
        'role': 'user',
        'content': 'Hello'
      }
    ],
    'provider': {
      'order': [
        'deepinfra/turbo'
      ],
      'allow_fallbacks': false
    }
  }),
});
This approach is especially useful when you want to consistently use a specific variant of a model from a particular provider.

Requiring Providers to Support All Parameters
You can restrict requests only to providers that support all parameters in your request using the require_parameters field.

Field	Type	Default	Description
require_parameters	boolean	false	Only use providers that support all parameters in your request.
With the default routing strategy, providers that don’t support all the LLM parameters specified in your request can still receive the request, but will ignore unknown parameters. When you set require_parameters to true, the request won’t even be routed to that provider.

Example: Excluding providers that don’t support JSON formatting
For example, to only use providers that support JSON formatting:


TypeScript

Python

fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer <OPENROUTER_API_KEY>',
    'HTTP-Referer': '<YOUR_SITE_URL>', // Optional. Site URL for rankings on openrouter.ai.
    'X-Title': '<YOUR_SITE_NAME>', // Optional. Site title for rankings on openrouter.ai.
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    'messages': [
      {
        'role': 'user',
        'content': 'Hello'
      }
    ],
    'provider': {
      'require_parameters': true
    },
    'response_format': {
      'type': 'json_object'
    }
  }),
});
Requiring Providers to Comply with Data Policies
You can restrict requests only to providers that comply with your data policies using the data_collection field.

Field	Type	Default	Description
data_collection	”allow” | “deny"	"allow”	Control whether to use providers that may store data.
allow: (default) allow providers which store user data non-transiently and may train on it
deny: use only providers which do not collect user data
Some model providers may log prompts, so we display them with a Data Policy tag on model pages. This is not a definitive source of third party data policies, but represents our best knowledge.

Account-Wide Data Policy Filtering
This is also available as an account-wide setting in your privacy settings. You can disable third party model providers that store inputs for training.

Example: Excluding providers that don’t comply with data policies
To exclude providers that don’t comply with your data policies, set data_collection to deny:


TypeScript

Python

fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer <OPENROUTER_API_KEY>',
    'HTTP-Referer': '<YOUR_SITE_URL>', // Optional. Site URL for rankings on openrouter.ai.
    'X-Title': '<YOUR_SITE_NAME>', // Optional. Site title for rankings on openrouter.ai.
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    'messages': [
      {
        'role': 'user',
        'content': 'Hello'
      }
    ],
    'provider': {
      'data_collection': 'deny'
    }
  }),
});
Disabling Fallbacks
To guarantee that your request is only served by the top (lowest-cost) provider, you can disable fallbacks.

This is combined with the order field from Ordering Specific Providers to restrict the providers that OpenRouter will prioritize to just your chosen list.


TypeScript

Python

fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer <OPENROUTER_API_KEY>',
    'HTTP-Referer': '<YOUR_SITE_URL>', // Optional. Site URL for rankings on openrouter.ai.
    'X-Title': '<YOUR_SITE_NAME>', // Optional. Site title for rankings on openrouter.ai.
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    'messages': [
      {
        'role': 'user',
        'content': 'Hello'
      }
    ],
    'provider': {
      'allow_fallbacks': false
    }
  }),
});
Allowing Only Specific Providers
You can allow only specific providers for a request by setting the only field in the provider object.

Field	Type	Default	Description
only	string[]	-	List of provider slugs to allow for this request.
Only allowing some providers may significantly reduce fallback options and limit request recovery.

Account-Wide Allowed Providers
You can allow providers for all account requests by configuring your preferences. This configuration applies to all API requests and chatroom messages.

Note that when you allow providers for a specific request, the list of allowed providers is merged with your account-wide allowed providers.

Example: Allowing Azure for a request calling GPT-4 Omni
Here’s an example that will only use Azure for a request calling GPT-4 Omni:


TypeScript

Python

fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer <OPENROUTER_API_KEY>',
    'HTTP-Referer': '<YOUR_SITE_URL>', // Optional. Site URL for rankings on openrouter.ai.
    'X-Title': '<YOUR_SITE_NAME>', // Optional. Site title for rankings on openrouter.ai.
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    'model': 'openai/gpt-4o',
    'messages': [
      {
        'role': 'user',
        'content': 'Hello'
      }
    ],
    'provider': {
      'only': [
        'azure'
      ]
    }
  }),
});
Ignoring Providers
You can ignore providers for a request by setting the ignore field in the provider object.

Field	Type	Default	Description
ignore	string[]	-	List of provider slugs to skip for this request.
Ignoring multiple providers may significantly reduce fallback options and limit request recovery.

Account-Wide Ignored Providers
You can ignore providers for all account requests by configuring your preferences. This configuration applies to all API requests and chatroom messages.

Note that when you ignore providers for a specific request, the list of ignored providers is merged with your account-wide ignored providers.

Example: Ignoring DeepInfra for a request calling Llama 3.3 70b
Here’s an example that will ignore DeepInfra for a request calling Llama 3.3 70b:


TypeScript

Python

fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer <OPENROUTER_API_KEY>',
    'HTTP-Referer': '<YOUR_SITE_URL>', // Optional. Site URL for rankings on openrouter.ai.
    'X-Title': '<YOUR_SITE_NAME>', // Optional. Site title for rankings on openrouter.ai.
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    'model': 'meta-llama/llama-3.3-70b-instruct',
    'messages': [
      {
        'role': 'user',
        'content': 'Hello'
      }
    ],
    'provider': {
      'ignore': [
        'deepinfra'
      ]
    }
  }),
});
Quantization
Quantization reduces model size and computational requirements while aiming to preserve performance. Most LLMs today use FP16 or BF16 for training and inference, cutting memory requirements in half compared to FP32. Some optimizations use FP8 or quantization to reduce size further (e.g., INT8, INT4).

Field	Type	Default	Description
quantizations	string[]	-	List of quantization levels to filter by (e.g. ["int4", "int8"]). Learn more
Quantized models may exhibit degraded performance for certain prompts, depending on the method used.

Providers can support various quantization levels for open-weight models.

Quantization Levels
By default, requests are load-balanced across all available providers, ordered by price. To filter providers by quantization level, specify the quantizations field in the provider parameter with the following values:

int4: Integer (4 bit)
int8: Integer (8 bit)
fp4: Floating point (4 bit)
fp6: Floating point (6 bit)
fp8: Floating point (8 bit)
fp16: Floating point (16 bit)
bf16: Brain floating point (16 bit)
fp32: Floating point (32 bit)
unknown: Unknown
Example: Requesting FP8 Quantization
Here’s an example that will only use providers that support FP8 quantization:


TypeScript

Python

fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer <OPENROUTER_API_KEY>',
    'HTTP-Referer': '<YOUR_SITE_URL>', // Optional. Site URL for rankings on openrouter.ai.
    'X-Title': '<YOUR_SITE_NAME>', // Optional. Site title for rankings on openrouter.ai.
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    'model': 'meta-llama/llama-3.1-8b-instruct',
    'messages': [
      {
        'role': 'user',
        'content': 'Hello'
      }
    ],
    'provider': {
      'quantizations': [
        'fp8'
      ]
    }
  }),
});
Max Price
To filter providers by price, specify the max_price field in the provider parameter with a JSON object specifying the highest provider pricing you will accept.

For example, the value {"prompt": 1, "completion": 2} will route to any provider with a price of <= $1/m prompt tokens, and <= $2/m completion tokens or less.

Some providers support per request pricing, in which case you can use the request attribute of max_price. Lastly, image is also available, which specifies the max price per image you will accept.

Practically, this field is often combined with a provider sort to express, for example, “Use the provider with the highest throughput, as long as it doesn’t cost more than $x/m tokens.”

Terms of Service
You can view the terms of service for each provider below. You may not violate the terms of service or policies of third-party providers that power the models on OpenRouter.

AI21: https://www.ai21.com/terms-of-service/
AionLabs: https://www.aionlabs.ai/terms/
Alibaba: https://www.alibabacloud.com/help/en/legal/latest/alibaba-cloud-international-website-product-terms-of-service-v-3-8-0
Amazon Bedrock: https://aws.amazon.com/service-terms/
Anthropic: https://www.anthropic.com/legal/commercial-terms
AtlasCloud: https://www.atlascloud.ai/privacy
Atoma: https://atoma.network/terms_of_service
Avian.io: https://avian.io/terms
Azure: https://www.microsoft.com/en-us/legal/terms-of-use?oneroute=true
Baseten: https://www.baseten.co/terms-and-conditions
CentML: https://centml.ai/terms-of-service/
Cerebras: https://www.cerebras.ai/terms-of-service
Chutes: https://chutes.ai/tos
Cloudflare: https://www.cloudflare.com/service-specific-terms-developer-platform/#developer-platform-terms
Cohere: https://cohere.com/terms-of-use
CrofAI: https://ai.nahcrof.com/privacy
Crusoe: https://legal.crusoe.ai/open-router#managed-inference-tos-open-router
DeepInfra: https://deepinfra.com/terms
DeepSeek: https://chat.deepseek.com/downloads/DeepSeek%20Terms%20of%20Use.html
Enfer: https://enfer.ai/privacy-policy
Featherless: https://featherless.ai/terms
Fireworks: https://fireworks.ai/terms-of-service
Friendli: https://friendli.ai/terms-of-service
GMICloud: https://docs.gmicloud.ai/privacy
Google Vertex: https://cloud.google.com/terms/
Google AI Studio: https://cloud.google.com/terms/
Groq: https://groq.com/terms-of-use/
Hyperbolic: https://hyperbolic.xyz/terms
Inception: https://www.inceptionlabs.ai/terms
inference.net: https://inference.net/terms-of-service
Infermatic: https://infermatic.ai/terms-and-conditions/
Inflection: https://developers.inflection.ai/tos
InoCloud: https://inocloud.com/terms
kluster.ai: https://www.kluster.ai/terms-of-use
Lambda: https://lambda.ai/legal/terms-of-service
Liquid: https://www.liquid.ai/terms-conditions
Mancer (private): https://mancer.tech/terms
Meta: https://llama.developer.meta.com/legal/terms-of-service
Minimax: https://www.minimax.io/platform/protocol/terms-of-service
Mistral: https://mistral.ai/terms/#terms-of-use
nCompass: https://ncompass.tech/terms
Nebius AI Studio: https://docs.nebius.com/legal/studio/terms-of-use/
NextBit: https://www.nextbit256.com/docs/terms-of-service
Nineteen: https://nineteen.ai/tos
NovitaAI: https://novita.ai/legal/terms-of-service
OpenAI: https://openai.com/policies/row-terms-of-use/
OpenInference: https://www.openinference.xyz/terms
Parasail: https://www.parasail.io/legal/terms
Perplexity: https://www.perplexity.ai/hub/legal/perplexity-api-terms-of-service
Phala: https://red-pill.ai/terms
SambaNova: https://sambanova.ai/terms-and-conditions
Targon: https://targon.com/terms
Together: https://www.together.ai/terms-of-service
Ubicloud: https://www.ubicloud.com/docs/about/terms-of-service
Venice: https://venice.ai/legal/tos
xAI: https://x.ai/legal/terms-of-service
JSON Schema for Provider Preferences
For a complete list of options, see this JSON schema:

Provider Preferences Schema

{
    "$ref": "#/definitions/Provider Preferences Schema",
    "definitions": {
      "Provider Preferences Schema": {
        "type": "object",
        "properties": {
          "allow_fallbacks": {
            "type": [
              "boolean",
              "null"
            ],
            "description": "Whether to allow backup providers to serve requests\n- true: (default) when the primary provider (or your custom providers in \"order\") is unavailable, use the next best provider.\n- false: use only the primary/custom provider, and return the upstream error if it's unavailable.\n"
          },
          "require_parameters": {
            "type": [
              "boolean",
              "null"
            ],
            "description": "Whether to filter providers to only those that support the parameters you've provided. If this setting is omitted or set to false, then providers will receive only the parameters they support, and ignore the rest."
          },
          "data_collection": {
            "anyOf": [
              {
                "type": "string",
                "enum": [
                  "deny",
                  "allow"
                ]
              },
              {
                "type": "null"
              }
            ],
            "description": "Data collection setting. If no available model provider meets the requirement, your request will return an error.\n- allow: (default) allow providers which store user data non-transiently and may train on it\n- deny: use only providers which do not collect user data.\n"
          },
          "order": {
            "anyOf": [
              {
                "type": "array",
                "items": {
                  "anyOf": [
                    {
                      "type": "string",
                      "enum": [
                        "AnyScale",
                        "HuggingFace",
                        "Hyperbolic 2",
                        "Lepton",
                        "Lynn 2",
                        "Lynn",
                        "Mancer",
                        "Modal",
                        "OctoAI",
                        "Recursal",
                        "Reflection",
                        "Replicate",
                        "SambaNova 2",
                        "SF Compute",
                        "Together 2",
                        "01.AI",
                        "AI21",
                        "AionLabs",
                        "Alibaba",
                        "Amazon Bedrock",
                        "Anthropic",
                        "AtlasCloud",
                        "Atoma",
                        "Avian",
                        "Azure",
                        "BaseTen",
                        "Cent-ML",
                        "Cerebras",
                        "Chutes",
                        "Cloudflare",
                        "Cohere",
                        "CrofAI",
                        "Crusoe",
                        "DeepInfra",
                        "DeepSeek",
                        "Enfer",
                        "Featherless",
                        "Fireworks",
                        "Friendli",
                        "GMICloud",
                        "Google",
                        "Google AI Studio",
                        "Groq",
                        "Hyperbolic",
                        "Inception",
                        "InferenceNet",
                        "Infermatic",
                        "Inflection",
                        "InoCloud",
                        "Kluster",
                        "Lambda",
                        "Liquid",
                        "Mancer 2",
                        "Meta",
                        "Minimax",
                        "Mistral",
                        "NCompass",
                        "Nebius",
                        "NextBit",
                        "Nineteen",
                        "Novita",
                        "OpenAI",
                        "OpenInference",
                        "Parasail",
                        "Perplexity",
                        "Phala",
                        "SambaNova",
                        "Stealth",
                        "Targon",
                        "Together",
                        "Ubicloud",
                        "Venice",
                        "xAI"
                      ]
                    },
                    {
                      "type": "string"
                    }
                  ]
                }
              },
              {
                "type": "null"
              }
            ],
            "description": "An ordered list of provider slugs. The router will attempt to use the first provider in the subset of this list that supports your requested model, and fall back to the next if it is unavailable. If no providers are available, the request will fail with an error message."
          },
          "only": {
            "anyOf": [
              {
                "$ref": "#/definitions/Provider Preferences Schema/properties/order/anyOf/0"
              },
              {
                "type": "null"
              }
            ],
            "description": "List of provider slugs to allow. If provided, this list is merged with your account-wide allowed provider settings for this request."
          },
          "ignore": {
            "anyOf": [
              {
                "$ref": "#/definitions/Provider Preferences Schema/properties/order/anyOf/0"
              },
              {
                "type": "null"
              }
            ],
            "description": "List of provider slugs to ignore. If provided, this list is merged with your account-wide ignored provider settings for this request."
          },
          "quantizations": {
            "anyOf": [
              {
                "type": "array",
                "items": {
                  "type": "string",
                  "enum": [
                    "int4",
                    "int8",
                    "fp4",
                    "fp6",
                    "fp8",
                    "fp16",
                    "bf16",
                    "fp32",
                    "unknown"
                  ]
                }
              },
              {
                "type": "null"
              }
            ],
            "description": "A list of quantization levels to filter the provider by."
          },
          "sort": {
            "anyOf": [
              {
                "type": "string",
                "enum": [
                  "price",
                  "throughput",
                  "latency"
                ]
              },
              {
                "type": "null"
              }
            ],
            "description": "The sorting strategy to use for this request, if \"order\" is not specified. When set, no load balancing is performed."
          },
          "max_price": {
            "type": "object",
            "properties": {
              "prompt": {
                "anyOf": [
                  {
                    "type": "number"
                  },
                  {
                    "type": "string"
                  },
                  {}
                ]
              },
              "completion": {
                "$ref": "#/definitions/Provider Preferences Schema/properties/max_price/properties/prompt"
              },
              "image": {
                "$ref": "#/definitions/Provider Preferences Schema/properties/max_price/properties/prompt"
              },
              "request": {
                "$ref": "#/definitions/Provider Preferences Schema/properties/max_price/properties/prompt"
              }
            },
            "additionalProperties": false,
            "description": "The object specifying the maximum price you want to pay for this request. USD price per million tokens, for prompt and completion."
          },
          "experimental": {
            "anyOf": [
              {
                "type": "object",
                "properties": {
                  "force_chat_completions": {
                    "type": [
                      "boolean",
                      "null"
                    ]
                  }
                },
                "additionalProperties": false
              },
              {
                "type": "null"
              }
            ]
          }
        },
        "additionalProperties": false
      }
    },
    "$schema": "http://json-schema.org/draft-07/schema#"
  }
Was this page helpful?
Yes
No
Previous
Prompt Caching

Cache prompt messages

Next
Built with
Provider Routing | Intelligent Multi-Provider Request Routing | OpenRouter | Documentation
Logo
Search or ask AI a question
/
API
Models
Chat
Ranking
Login

Overview
Quickstart
FAQ
Principles
Models
Features
Privacy and Logging
Model Routing
Provider Routing
Prompt Caching
Structured Outputs
Tool Calling
Images & PDFs
Message Transforms
Uptime Optimization
Web Search
Zero Completion Insurance
Provisioning API Keys
API Reference
Overview
Streaming
Limits
Authentication
Parameters
Errors
POST
Completion
POST
Chat completion
GET
Get a generation
GET
List available models
GET
List endpoints for a model
GET
Get credits
POST
Create a Coinbase charge

Authentication

API Keys
Use Cases
BYOK
Crypto API
OAuth PKCE
MCP Servers
For Providers
Reasoning Tokens
Usage Accounting
Community
Frameworks
Discord
On this page
Inspecting cache usage
OpenAI
Anthropic Claude
DeepSeek
Google Gemini
Implicit Caching
Pricing Changes for Cached Requests:
Supported Models and Limitations:
How Gemini Prompt Caching works on OpenRouter:
How to Enable Gemini Prompt Caching:
Examples:
System Message Caching Example
User Message Caching Example
Features
Prompt Caching


Copy page

Cache prompt messages

To save on inference costs, you can enable prompt caching on supported providers and models.

Most providers automatically enable prompt caching, but note that some (see Anthropic below) require you to enable it on a per-message basis.

When using caching (whether automatically in supported models, or via the cache_control header), OpenRouter will make a best-effort to continue routing to the same provider to make use of the warm cache. In the event that the provider with your cached prompt is not available, OpenRouter will try the next-best provider.

Inspecting cache usage
To see how much caching saved on each generation, you can:

Click the detail button on the Activity page
Use the /api/v1/generation API, documented here
Use usage: {include: true} in your request to get the cache tokens at the end of the response (see Usage Accounting for details)
The cache_discount field in the response body will tell you how much the response saved on cache usage. Some providers, like Anthropic, will have a negative discount on cache writes, but a positive discount (which reduces total cost) on cache reads.

OpenAI
Caching price changes:

Cache writes: no cost
Cache reads: (depending on the model) charged at 0.5x or 0.75x the price of the original input pricing
Click here to view OpenAI’s cache pricing per model.

Prompt caching with OpenAI is automated and does not require any additional configuration. There is a minimum prompt size of 1024 tokens.

Click here to read more about OpenAI prompt caching and its limitation.

Anthropic Claude
Caching price changes:

Cache writes: charged at 1.25x the price of the original input pricing
Cache reads: charged at 0.1x the price of the original input pricing
Prompt caching with Anthropic requires the use of cache_control breakpoints. There is a limit of four breakpoints, and the cache will expire within five minutes. Therefore, it is recommended to reserve the cache breakpoints for large bodies of text, such as character cards, CSV data, RAG data, book chapters, etc.

Click here to read more about Anthropic prompt caching and its limitation.

The cache_control breakpoint can only be inserted into the text part of a multipart message.

System message caching example:

{
  "messages": [
    {
      "role": "system",
      "content": [
        {
          "type": "text",
          "text": "You are a historian studying the fall of the Roman Empire. You know the following book very well:"
        },
        {
          "type": "text",
          "text": "HUGE TEXT BODY",
          "cache_control": {
            "type": "ephemeral"
          }
        }
      ]
    },
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "What triggered the collapse?"
        }
      ]
    }
  ]
}

User message caching example:

{
  "messages": [
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "Given the book below:"
        },
        {
          "type": "text",
          "text": "HUGE TEXT BODY",
          "cache_control": {
            "type": "ephemeral"
          }
        },
        {
          "type": "text",
          "text": "Name all the characters in the above book"
        }
      ]
    }
  ]
}

DeepSeek
Caching price changes:

Cache writes: charged at the same price as the original input pricing
Cache reads: charged at 0.1x the price of the original input pricing
Prompt caching with DeepSeek is automated and does not require any additional configuration.

Google Gemini
Implicit Caching
Gemini 2.5 Pro and 2.5 Flash models now support implicit caching, providing automatic caching functionality similar to OpenAI’s automatic caching. Implicit caching works seamlessly — no manual setup or additional cache_control breakpoints required.

Pricing Changes:

No cache write or storage costs.
Cached tokens are charged at 0.25x the original input token cost.
Note that the TTL is on average 3-5 minutes, but will vary. There is a minimum of 1028 tokens for Gemini 2.5 Flash, and 2048 tokens for Gemini 2.5 Pro for requests to be eligible for caching.

Official announcement from Google

To maximize implicit cache hits, keep the initial portion of your message arrays consistent between requests. Push variations (such as user questions or dynamic context elements) toward the end of your prompt/requests.

Pricing Changes for Cached Requests:
Cache Writes: Charged at the input token cost plus 5 minutes of cache storage, calculated as follows:
Cache write cost = Input token price + (Cache storage price × (5 minutes / 60 minutes))

Cache Reads: Charged at 0.25× the original input token cost.
Supported Models and Limitations:
Only certain Gemini models support caching. Please consult Google’s Gemini API Pricing Documentation for the most current details.

Cache Writes have a 5 minute Time-to-Live (TTL) that does not update. After 5 minutes, the cache expires and a new cache must be written.

Gemini models have typically have a 4096 token minimum for cache write to occur. Cached tokens count towards the model’s maximum token usage. Gemini 2.5 Pro has a minimum of 2048 tokens, and Gemini 2.5 Flash has a minimum of 1028 tokens.

How Gemini Prompt Caching works on OpenRouter:
OpenRouter simplifies Gemini cache management, abstracting away complexities:

You do not need to manually create, update, or delete caches.
You do not need to manage cache names or TTL explicitly.
How to Enable Gemini Prompt Caching:
Gemini caching in OpenRouter requires you to insert cache_control breakpoints explicitly within message content, similar to Anthropic. We recommend using caching primarily for large content pieces (such as CSV files, lengthy character cards, retrieval augmented generation (RAG) data, or extensive textual sources).

There is not a limit on the number of cache_control breakpoints you can include in your request. OpenRouter will use only the last breakpoint for Gemini caching. Including multiple breakpoints is safe and can help maintain compatibility with Anthropic, but only the final one will be used for Gemini.

Examples:
System Message Caching Example
{
  "messages": [
    {
      "role": "system",
      "content": [
        {
          "type": "text",
          "text": "You are a historian studying the fall of the Roman Empire. Below is an extensive reference book:"
        },
        {
          "type": "text",
          "text": "HUGE TEXT BODY HERE",
          "cache_control": {
            "type": "ephemeral"
          }
        }
      ]
    },
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "What triggered the collapse?"
        }
      ]
    }
  ]
}

User Message Caching Example
{
  "messages": [
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "Based on the book text below:"
        },
        {
          "type": "text",
          "text": "HUGE TEXT BODY HERE",
          "cache_control": {
            "type": "ephemeral"
          }
        },
        {
          "type": "text",
          "text": "List all main characters mentioned in the text above."
        }
      ]
    }
  ]
}

Was this page helpful?
Yes
No
Previous
Structured Outputs

Return structured data from your models

Next
Built with
Prompt Caching | Reduce AI Model Costs with OpenRouter | OpenRouter | Documentation
Logo
Search or ask AI a question
/
API
Models
Chat
Ranking
Login

Overview
Quickstart
FAQ
Principles
Models
Features
Privacy and Logging
Model Routing
Provider Routing
Prompt Caching
Structured Outputs
Tool Calling
Images & PDFs
Message Transforms
Uptime Optimization
Web Search
Zero Completion Insurance
Provisioning API Keys
API Reference
Overview
Streaming
Limits
Authentication
Parameters
Errors
POST
Completion
POST
Chat completion
GET
Get a generation
GET
List available models
GET
List endpoints for a model
GET
Get credits
POST
Create a Coinbase charge

Authentication

API Keys
Use Cases
BYOK
Crypto API
OAuth PKCE
MCP Servers
For Providers
Reasoning Tokens
Usage Accounting
Community
Frameworks
Discord
On this page
Overview
Using Structured Outputs
Model Support
Best Practices
Example Implementation
Streaming with Structured Outputs
Error Handling
Features
Structured Outputs


Copy page

Return structured data from your models

OpenRouter supports structured outputs for compatible models, ensuring responses follow a specific JSON Schema format. This feature is particularly useful when you need consistent, well-formatted responses that can be reliably parsed by your application.

Overview
Structured outputs allow you to:

Enforce specific JSON Schema validation on model responses
Get consistent, type-safe outputs
Avoid parsing errors and hallucinated fields
Simplify response handling in your application
Using Structured Outputs
To use structured outputs, include a response_format parameter in your request, with type set to json_schema and the json_schema object containing your schema:

{
  "messages": [
    { "role": "user", "content": "What's the weather like in London?" }
  ],
  "response_format": {
    "type": "json_schema",
    "json_schema": {
      "name": "weather",
      "strict": true,
      "schema": {
        "type": "object",
        "properties": {
          "location": {
            "type": "string",
            "description": "City or location name"
          },
          "temperature": {
            "type": "number",
            "description": "Temperature in Celsius"
          },
          "conditions": {
            "type": "string",
            "description": "Weather conditions description"
          }
        },
        "required": ["location", "temperature", "conditions"],
        "additionalProperties": false
      }
    }
  }
}

The model will respond with a JSON object that strictly follows your schema:

{
  "location": "London",
  "temperature": 18,
  "conditions": "Partly cloudy with light drizzle"
}

Model Support
Structured outputs are supported by select models.

You can find a list of models that support structured outputs on the models page.

OpenAI models (GPT-4o and later versions) Docs
All Fireworks provided models Docs
To ensure your chosen model supports structured outputs:

Check the model’s supported parameters on the models page
Set require_parameters: true in your provider preferences (see Provider Routing)
Include response_format and set type: json_schema in the required parameters
Best Practices
Include descriptions: Add clear descriptions to your schema properties to guide the model

Use strict mode: Always set strict: true to ensure the model follows your schema exactly

Example Implementation
Here’s a complete example using the Fetch API:


With TypeScript

With Python

const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    Authorization: 'Bearer <OPENROUTER_API_KEY>',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'openai/gpt-4',
    messages: [
      { role: 'user', content: 'What is the weather like in London?' },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'weather',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            location: {
              type: 'string',
              description: 'City or location name',
            },
            temperature: {
              type: 'number',
              description: 'Temperature in Celsius',
            },
            conditions: {
              type: 'string',
              description: 'Weather conditions description',
            },
          },
          required: ['location', 'temperature', 'conditions'],
          additionalProperties: false,
        },
      },
    },
  }),
});
const data = await response.json();
const weatherInfo = data.choices[0].message.content;
Streaming with Structured Outputs
Structured outputs are also supported with streaming responses. The model will stream valid partial JSON that, when complete, forms a valid response matching your schema.

To enable streaming with structured outputs, simply add stream: true to your request:

{
  "stream": true,
  "response_format": {
    "type": "json_schema",
    // ... rest of your schema
  }
}

Error Handling
When using structured outputs, you may encounter these scenarios:

Model doesn’t support structured outputs: The request will fail with an error indicating lack of support
Invalid schema: The model will return an error if your JSON Schema is invalid
Was this page helpful?
Yes
No
Previous
Tool & Function Calling

Use tools in your prompts

Next
Built with
Structured Outputs | Enforce JSON Schema in OpenRouter API Responses | OpenRouter | Documentation
Logo
Search or ask AI a question
/
API
Models
Chat
Ranking
Login

Overview
Quickstart
FAQ
Principles
Models
Features
Privacy and Logging
Model Routing
Provider Routing
Prompt Caching
Structured Outputs
Tool Calling
Images & PDFs
Message Transforms
Uptime Optimization
Web Search
Zero Completion Insurance
Provisioning API Keys
API Reference
Overview
Streaming
Limits
Authentication
Parameters
Errors
POST
Completion
POST
Chat completion
GET
Get a generation
GET
List available models
GET
List endpoints for a model
GET
Get credits
POST
Create a Coinbase charge

Authentication

API Keys
Use Cases
BYOK
Crypto API
OAuth PKCE
MCP Servers
For Providers
Reasoning Tokens
Usage Accounting
Community
Frameworks
Discord
On this page
Image Inputs
Using Image URLs
Using Base64 Encoded Images
PDF Support
Processing PDFs
Pricing
Skip Parsing Costs
Response Format
Features
Images & PDFs


Copy page

How to send images and PDFs to OpenRouter

OpenRouter supports sending images and PDFs via the API. This guide will show you how to work with both file types using our API.

Both images and PDFs also work in the chat room.

You can send both PDF and images in the same request.
Image Inputs
Requests with images, to multimodel models, are available via the /api/v1/chat/completions API with a multi-part messages parameter. The image_url can either be a URL or a base64-encoded image. Note that multiple images can be sent in separate content array entries. The number of images you can send in a single request varies per provider and per model. Due to how the content is parsed, we recommend sending the text prompt first, then the images. If the images must come first, we recommend putting it in the system prompt.

Using Image URLs
Here’s how to send an image using a URL:


Python

TypeScript

const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${API_KEY_REF}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'google/gemini-2.0-flash-001',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: "What's in this image?",
          },
          {
            type: 'image_url',
            image_url: {
              url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Gfp-wisconsin-madison-the-nature-boardwalk.jpg/2560px-Gfp-wisconsin-madison-the-nature-boardwalk.jpg',
            },
          },
        ],
      },
    ],
  }),
});
const data = await response.json();
console.log(data);
Using Base64 Encoded Images
For locally stored images, you can send them using base64 encoding. Here’s how to do it:


Python

TypeScript

async function encodeImageToBase64(imagePath: string): Promise<string> {
  const imageBuffer = await fs.promises.readFile(imagePath);
  const base64Image = imageBuffer.toString('base64');
  return `data:image/jpeg;base64,${base64Image}`;
}
// Read and encode the image
const imagePath = 'path/to/your/image.jpg';
const base64Image = await encodeImageToBase64(imagePath);
const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${API_KEY_REF}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'google/gemini-2.0-flash-001',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: "What's in this image?",
          },
          {
            type: 'image_url',
            image_url: {
              url: base64Image,
            },
          },
        ],
      },
    ],
  }),
});
const data = await response.json();
console.log(data);
Supported image content types are:

image/png
image/jpeg
image/webp
PDF Support
OpenRouter supports PDF processing through the /api/v1/chat/completions API. PDFs can be sent as base64-encoded data URLs in the messages array, via the file content type. This feature works on any model on OpenRouter.

When a model supports file input natively, the PDF is passed directly to the model. When the model does not support file input natively, OpenRouter will parse the file and pass the parsed results to the requested model.

Note that multiple PDFs can be sent in separate content array entries. The number of PDFs you can send in a single request varies per provider and per model. Due to how the content is parsed, we recommend sending the text prompt first, then the PDF. If the PDF must come first, we recommend putting it in the system prompt.

Processing PDFs
Here’s how to send and process a PDF:


Python

TypeScript

async function encodePDFToBase64(pdfPath: string): Promise<string> {
  const pdfBuffer = await fs.promises.readFile(pdfPath);
  const base64PDF = pdfBuffer.toString('base64');
  return `data:application/pdf;base64,${base64PDF}`;
}
// Read and encode the PDF
const pdfPath = 'path/to/your/document.pdf';
const base64PDF = await encodePDFToBase64(pdfPath);
const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${API_KEY_REF}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'google/gemma-3-27b-it',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'What are the main points in this document?',
          },
          {
            type: 'file',
            file: {
              filename: 'document.pdf',
              file_data: base64PDF,
            },
          },
        ],
      },
    ],
    // Optional: Configure PDF processing engine
    // PDF parsing will still work even if the plugin is not explicitly set
    plugins: [
      {
        id: 'file-parser',
        pdf: {
          engine: 'pdf-text', // defaults to "mistral-ocr". See Pricing below
        },
      },
    ],
  }),
});
const data = await response.json();
console.log(data);
Pricing
OpenRouter provides several PDF processing engines:

"mistral-ocr": Best for scanned documents or PDFs with images ($2 per 1,000 pages).
"pdf-text": Best for well-structured PDFs with clear text content (Free).
"native": Only available for models that support file input natively (charged as input tokens).
If you don’t explicitly specify an engine, OpenRouter will default first to the model’s native file processing capabilities, and if that’s not available, we will use the "mistral-ocr" engine.

To select an engine, use the plugin configuration:


Python

TypeScript

{
  plugins: [
    {
      id: 'file-parser',
      pdf: {
        engine: 'mistral-ocr',
      },
    },
  ],
}
Skip Parsing Costs
When you send a PDF to the API, the response may include file annotations in the assistant’s message. These annotations contain structured information about the PDF document that was parsed. By sending these annotations back in subsequent requests, you can avoid re-parsing the same PDF document multiple times, which saves both processing time and costs.

Here’s how to reuse file annotations:


Python

TypeScript

import fs from 'fs/promises';
import { fetch } from 'node-fetch';
async function encodePDFToBase64(pdfPath: string): Promise<string> {
  const pdfBuffer = await fs.readFile(pdfPath);
  const base64PDF = pdfBuffer.toString('base64');
  return `data:application/pdf;base64,${base64PDF}`;
}
// Initial request with the PDF
async function processDocument() {
  // Read and encode the PDF
  const pdfPath = 'path/to/your/document.pdf';
  const base64PDF = await encodePDFToBase64(pdfPath);
  const initialResponse = await fetch(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${API_KEY_REF}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemma-3-27b-it',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'What are the main points in this document?',
              },
              {
                type: 'file',
                file: {
                  filename: 'document.pdf',
                  file_data: base64PDF,
                },
              },
            ],
          },
        ],
      }),
    },
  );
  const initialData = await initialResponse.json();
  // Store the annotations from the response
  let fileAnnotations = null;
  if (initialData.choices && initialData.choices.length > 0) {
    if (initialData.choices[0].message.annotations) {
      fileAnnotations = initialData.choices[0].message.annotations;
    }
  }
  // Follow-up request using the annotations (without sending the PDF again)
  if (fileAnnotations) {
    const followUpResponse = await fetch(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${API_KEY_REF}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemma-3-27b-it',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'What are the main points in this document?',
                },
                {
                  type: 'file',
                  file: {
                    filename: 'document.pdf',
                    file_data: base64PDF,
                  },
                },
              ],
            },
            {
              role: 'assistant',
              content: 'The document contains information about...',
              annotations: fileAnnotations,
            },
            {
              role: 'user',
              content: 'Can you elaborate on the second point?',
            },
          ],
        }),
      },
    );
    const followUpData = await followUpResponse.json();
    console.log(followUpData);
  }
}
processDocument();
When you include the file annotations from a previous response in your subsequent requests, OpenRouter will use this pre-parsed information instead of re-parsing the PDF, which saves processing time and costs. This is especially beneficial for large documents or when using the mistral-ocr engine which incurs additional costs.

Response Format
The API will return a response in the following format:

{
  "id": "gen-1234567890",
  "provider": "DeepInfra",
  "model": "google/gemma-3-27b-it",
  "object": "chat.completion",
  "created": 1234567890,
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "The document discusses..."
      }
    }
  ],
  "usage": {
    "prompt_tokens": 1000,
    "completion_tokens": 100,
    "total_tokens": 1100
  }
}

Was this page helpful?
Yes
No
Previous
Message Transforms

Transform prompt messages

Next
Built with
OpenRouter Images & PDFs | Complete Documentation | OpenRouter | Documentation
Logo
Search or ask AI a question
/
API
Models
Chat
Ranking
Login

Overview
Quickstart
FAQ
Principles
Models
Features
Privacy and Logging
Model Routing
Provider Routing
Prompt Caching
Structured Outputs
Tool Calling
Images & PDFs
Message Transforms
Uptime Optimization
Web Search
Zero Completion Insurance
Provisioning API Keys
API Reference
Overview
Streaming
Limits
Authentication
Parameters
Errors
POST
Completion
POST
Chat completion
GET
Get a generation
GET
List available models
GET
List endpoints for a model
GET
Get credits
POST
Create a Coinbase charge

Authentication

API Keys
Use Cases
BYOK
Crypto API
OAuth PKCE
MCP Servers
For Providers
Reasoning Tokens
Usage Accounting
Community
Frameworks
Discord
Features
Message Transforms


Copy page

Transform prompt messages

To help with prompts that exceed the maximum context size of a model, OpenRouter supports a custom parameter called transforms:

{
  transforms: ["middle-out"], // Compress prompts that are > context size.
  messages: [...],
  model // Works with any model
}

This can be useful for situations where perfect recall is not required. The transform works by removing or truncating messages from the middle of the prompt, until the prompt fits within the model’s context window.

In some cases, the issue is not the token context length, but the actual number of messages. The transform addresses this as well: For instance, Anthropic’s Claude models enforce a maximum of 1000 messages. When this limit is exceeded with middle-out enabled, the transform will keep half of the messages from the start and half from the end of the conversation.

When middle-out compression is enabled, OpenRouter will first try to find models whose context length is at least half of your total required tokens (input + completion). For example, if your prompt requires 10,000 tokens total, models with at least 5,000 context length will be considered. If no models meet this criteria, OpenRouter will fall back to using the model with the highest available context length.

The compression will then attempt to fit your content within the chosen model’s context window by removing or truncating content from the middle of the prompt. If middle-out compression is disabled and your total tokens exceed the model’s context length, the request will fail with an error message suggesting you either reduce the length or enable middle-out compression.

All OpenRouter endpoints with 8k (8,192 tokens) or less context length will default to using middle-out. To disable this, set transforms: [] in the request body.

The middle of the prompt is compressed because LLMs pay less attention to the middle of sequences.

Was this page helpful?
Yes
No
Previous
Uptime Optimization

OpenRouter tracks provider availability

Next
Built with
Message Transforms | Pre-process AI Model Inputs with OpenRouter | OpenRouter | Documentation
Logo
Search or ask AI a question
/
API
Models
Chat
Ranking
Login

Overview
Quickstart
FAQ
Principles
Models
Features
Privacy and Logging
Model Routing
Provider Routing
Prompt Caching
Structured Outputs
Tool Calling
Images & PDFs
Message Transforms
Uptime Optimization
Web Search
Zero Completion Insurance
Provisioning API Keys
API Reference
Overview
Streaming
Limits
Authentication
Parameters
Errors
POST
Completion
POST
Chat completion
GET
Get a generation
GET
List available models
GET
List endpoints for a model
GET
Get credits
POST
Create a Coinbase charge

Authentication

API Keys
Use Cases
BYOK
Crypto API
OAuth PKCE
MCP Servers
For Providers
Reasoning Tokens
Usage Accounting
Community
Frameworks
Discord
On this page
Within OpenRouter
Provider Policies
Training on Prompts
Data Retention & Logging
Features
Privacy, Logging, and Data Collection


Copy page

Making sure your data is safe

When using AI through OpenRouter, whether via the chat interface or the API, your prompts and responses go through multiple touchpoints. You have control over how your data is handled at each step.

This page is designed to give a practical overview of how your data is handled, stored, and used. More information is available in the privacy policy and terms of service.

Within OpenRouter
OpenRouter does not store your prompts or responses, unless you have explicitly opted in to prompt logging in your account settings. It’s as simple as that.

OpenRouter samples a small number of prompts for categorization to power our reporting and model ranking. If you are not opted in to prompt logging, any categorization of your prompts is stored completely anonymously and never associated with your account or user ID. The categorization is done by model with a zero-data-retention policy.

OpenRouter does store metadata (e.g. number of prompt and completion tokens, latency, etc) for each request. This is used to power our reporting and model ranking, and your activity feed.

Provider Policies
Training on Prompts
Each provider on OpenRouter has its own data handling policies. We reflect those policies in structured data on each AI endpoint that we offer.

On your account settings page, you can set whether you would like to allow routing to providers that may train on your data (according to their own policies). There are separate settings for paid and free models.

Wherever possible, OpenRouter works with providers to ensure that prompts will not be trained on, but there are exceptions. If you opt out of training in your account settings, OpenRouter will not route to providers that train. This setting has no bearing on OpenRouter’s own policies and what we do with your prompts.

Data Policy Filtering
You can restrict individual requests to only use providers with a certain data policy.

This is also available as an account-wide setting in your privacy settings.

Data Retention & Logging
Providers also have their own data retention policies, often for compliance reasons. OpenRouter does not have routing rules that change based on data retention policies of providers, but the retention policies as reflected in each provider’s terms are shown below. Any user of OpenRouter can ignore providers that don’t meet their own data retention requirements.

The full terms of service for each provider are linked from the provider’s page, and aggregated in the documentation.

Provider	Data Retention	Train on Prompts
AI21	Unknown retention policy	✓ Does not train
AionLabs	Unknown retention policy	✓ Does not train
Alibaba	Unknown retention policy	✓ Does not train
Amazon Bedrock	Zero retention	✓ Does not train
Anthropic	Retained for 30 days	✓ Does not train
AtlasCloud	Zero retention	✓ Does not train
Atoma	Zero retention	✓ Does not train
Avian.io	Unknown retention policy	✓ Does not train
Azure	Zero retention	✓ Does not train
Baseten	Zero retention	✓ Does not train
CentML	Zero retention	✓ Does not train
Cerebras	Zero retention	✓ Does not train
Chutes	Prompts are retained for unknown period	✕ May train
Cloudflare	Unknown retention policy	✓ Does not train
Cohere	Retained for 30 days	✓ Does not train
CrofAI	Unknown retention policy	✓ Does not train
Crusoe	Unknown retention policy	✓ Does not train
DeepInfra	Zero retention	✓ Does not train
DeepSeek	Prompts are retained for unknown period	✕ May train
Enfer	Unknown retention policy	✓ Does not train
Featherless	Zero retention	✓ Does not train
Fireworks	Zero retention	✓ Does not train
Friendli	Prompts are retained for unknown period	✓ Does not train
GMICloud	Unknown retention policy	✓ Does not train
Google Vertex	Retained for 30 days	✓ Does not train
Google Vertex (free)	Prompts are retained for unknown period	✕ May train
Google AI Studio	Retained for 55 days	✓ Does not train
Google AI Studio (free)	Retained for 55 days	✕ May train
Groq	Zero retention	✓ Does not train
Hyperbolic	Unknown retention policy	✓ Does not train
Inception	Zero retention	✓ Does not train
inference.net	Unknown retention policy	✓ Does not train
Infermatic	Zero retention	✓ Does not train
Inflection	Retained for 30 days	✓ Does not train
InoCloud	Zero retention	✓ Does not train
kluster.ai	Zero retention	✓ Does not train
Lambda	Unknown retention policy	✓ Does not train
Liquid	Unknown retention policy	✓ Does not train
Mancer (private)	Zero retention	✓ Does not train
Meta	Retained for 30 days	✓ Does not train
Minimax	Unknown retention policy	✓ Does not train
Mistral	Retained for 30 days	✓ Does not train
nCompass	Unknown retention policy	✓ Does not train
Nebius AI Studio	Zero retention	✓ Does not train
NextBit	Zero retention	✓ Does not train
Nineteen	Unknown retention policy	✓ Does not train
NovitaAI	Unknown retention policy	✓ Does not train
OpenAI	Retained for 30 days	✓ Does not train
OpenInference	Prompts are retained for unknown period	✕ May train
Parasail	Prompts are retained for unknown period	✓ Does not train
Perplexity	Unknown retention policy	✓ Does not train
Phala	Zero retention	✓ Does not train
SambaNova	Zero retention	✓ Does not train
Stealth	Prompts are retained for unknown period	✕ May train
Targon	Prompts are retained for unknown period	✕ May train
Together	Zero retention	✓ Does not train
Ubicloud	Unknown retention policy	✓ Does not train
Venice	Zero retention	✓ Does not train
xAI	Retained for 30 days	✓ Does not train
Was this page helpful?
Yes
No
Previous
Model Routing

Dynamically route requests to models
Next
Built with
Privacy, Logging, and Data Collection | Keeping your data safe | OpenRouter | Documentation


