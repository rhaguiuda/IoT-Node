# TODO

## menubar — portar para multi-device

A menubar (`menubar/`) ainda é single-device: está hardcoded ao tópico
`teras/iotnode/1/telemetry/#` (`MQTTClient.swift`). Como os devices agora
publicam sob o próprio MAC (ex.: `teras/iotnode/e8069066185c/...`), o app
**não recebe mais dados**.

O que precisa:
- Assinar o wildcard `teras/iotnode/+/telemetry/#` e extrair o `device_id` do tópico.
- Permitir escolher/fixar qual device exibir (a fonte da verdade dos nomes é a
  tabela `devices` do dashboard — opções: chamar `GET /api/devices`, ou um
  picker simples por MAC no app).
- Espelhar o comportamento do dashboard: com 1 device, mostrar direto; com 2+,
  um seletor.

Referência: ver como o dashboard resolve isso em
`dashboard/src/components/DeviceSelector.tsx` e `dashboard/src/lib/mqtt.ts`.

---

## Outros (pré-existentes)

- **WiFi hardcoded:** SSID/senha estão fixos em `firmware/src/main.cpp` —
  deveriam sair para config.
