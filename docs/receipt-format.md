# Receipt Format

## Fields

| Field | Type | Description |
|-------|------|-------------|
| request_id | UUID | Unique generation identifier |
| timestamp | ISO 8601 UTC | Receipt creation time |
| model_name | string | Model identifier |
| model_version | string | Model version/revision |
| model_hash | hex64 | SHA-256 fingerprint of model files |
| prompt_hash | hex64 | SHA-256 of UTF-8 prompt |
| response_hash | hex64 | SHA-256 of UTF-8 response |
| seed | int | Generation seed |
| generation_parameters | object | temperature, max_tokens, top_p, seed |
| credit_cost | int | Simulated credits charged |
| status | string | completed or failed |
| receipt_version | string | Schema version (1.0) |

## Canonical Serialization

```
RECEIPT_V1
credit_cost=10
generation_parameters={"max_tokens":128,"seed":42,"temperature":0.7,"top_p":0.9}
...
```

`receipt_hash = SHA256(canonical_bytes)`
