# Contrato de datos de gestión (Supabase)

Referencia para la app y el bridge. Los tipos completos generados están en
[`supabase/types/database.types.ts`](../supabase/types/database.types.ts) (regenerar con
`supabase gen types typescript --linked > supabase/types/database.types.ts`).

- Montos en COP, `numeric(12,2)`.
- Fechas `timestamptz`, con hora de negocio `America/Bogota`.
- Errores de los RPC:

  | `errcode` | Significado |
  |---|---|
  | `42501` | Permiso denegado |
  | `22023` | Dato inválido |
  | `P0002` | No encontrado |

  El `message` viene en español, listo para mostrar al usuario.

## Roles
- `user_roles`: `partner`, `coach`, `bridge`. Cada usuario lee sus propios roles; un socio lee todos.
- **Atleta** = usuario autenticado sin rol de gestión.

| RPC | Quién | Qué hace |
|---|---|---|
| `set_user_role(p_user_id, p_role, p_grant)` | socio | Da o quita un rol. No permite quitar el último socio. |
| `claim_role_invites()` | cualquiera | Aplica las invitaciones pendientes para el email del usuario. La app lo llama al iniciar sesión. |

`role_invites (email, roles[], partner_id)`: la escriben los socios. Se aplica sola cuando se crea la cuenta con ese email.

## Lecturas principales

| Vista / tabla | Contenido | Quién lee |
|---|---|---|
| `membership_status` | Una fila por miembro con el estado de su membresía. Ver detalle abajo. | Atleta: la suya. Staff: todas. |
| `debt_summary` | Deudas, más `member_name` y `status` (`pending`/`partial`/`paid`/`voided`) | Atleta: las suyas. Staff: todas. |
| `debt_items`, `debt_payments` | Detalle de cada deuda | Igual que `debt_summary` |
| `membership_renewals` | Historial, incluidas las pendientes de pago | Atleta: las suyas. Staff: todas. |
| `class_usages` | Consumos de tiquetera | Atleta: los suyos. Staff: todos. |
| `membership_plans`, `products` | Catálogos | Cualquier usuario autenticado |
| `partners` | Socios y porcentajes | Staff (para elegir quién recibe el dinero) |
| `expenses`, `incomes`, `partner_transfers`, `settlement_list`, `expense_categories`, `audit_log`, `role_invites` | Finanzas y administración | Solo socios |
| `access_commands`, `bridge_status` | Cola y estado del bridge | Staff y bridge |
| `notifications` | Avisos del usuario | El destinatario |

**Columnas de `membership_status`:**
- `status`: `active`, `expiring_soon`, `overdue`, `disabled`, `no_classes` o `no_membership`.
- `days_left` y `classes_left`.
- `debt_balance`.
- `has_pending_payment`.
- `hik_sync_pending`.

## Miembros y vínculo

| RPC | Quién | Notas |
|---|---|---|
| `upsert_member(p_id?, p_full_name, p_document_id, p_phone, p_email, p_notes)` | staff | Sin `p_id` crea un miembro; con `p_id` edita solo los campos que se envíen. |
| `request_member_link(p_document)` | atleta | Normaliza la cédula. Falla si la cuenta ya está vinculada. |
| `review_member_link(p_request_id, p_approve, p_note?)` | staff | Falla con un mensaje claro si la cédula o la cuenta ya están vinculadas. Si la persona no existe, la crea. |

## Membresías

| RPC | Quién | Notas |
|---|---|---|
| `renew_membership(p_member_id, p_plan_id, p_payment_method, p_received_by_partner, p_discount=0, p_discount_reason?, p_note?)` | staff | Si el plan sigue vigente, continúa desde el fin actual. Si hay descuento, exige el motivo. Exige el socio receptor cuando el monto es mayor que 0. Genera el ingreso y encola el comando para HikCentral. |
| `complete_pending_renewal(p_renewal_id, p_amount, p_payment_method, p_received_by_partner, p_plan_id?, p_note?)` | socio | Registra el pago de una renovación hecha en HikCentral y genera el ingreso. |
| `void_renewal(p_renewal_id, p_reason)` | socio | Anula la renovación y su ingreso. La vigencia no cambia. |
| `set_membership_validity(p_member_id, p_valid_from, p_valid_until)` | socio | Corrección manual de fechas. |
| `set_member_access(p_member_id, p_enabled)` | socio | Bloquea o desbloquea el acceso. |
| `use_class(p_member_id)` / `undo_class_usage(p_usage_id)` | staff | Descuenta o devuelve una clase de la tiquetera. Al llegar a 0 encola el bloqueo en HikCentral. |

`payment_method`: `cash`, `nequi`, `daviplata`, `bre_b`, `transfer`, `card` u `other`.

## Deudas y ventas

| RPC / tabla | Quién | Notas |
|---|---|---|
| `create_debt(p_member_id, p_concept, p_items)` | staff | `p_items` es un arreglo de objetos `{product_id?, name?, quantity, unit_price?, delivery_status?, note?}`. Si viene `product_id`, el nombre y el precio salen del catálogo. |
| `void_debt(p_debt_id, p_reason)` | staff | Falla si la deuda tiene abonos activos. |
| `insert debt_payments {debt_id, amount, payment_method, received_by_partner, note?}` | staff | Rechaza abonos mayores al saldo. Genera el ingreso automáticamente. |
| `update debt_items / debt_payments set deleted_at` | staff | Borrado lógico. Recalcula los totales y anula el ingreso. |
| `register_sale(p_product_id, p_quantity, p_payment_method, p_received_by_partner, p_unit_price?, p_note?)` | staff | Venta de contado, registrada como ingreso `sale`. |

## Caja y cuadres (solo socios)
- **`expenses` e `incomes`:** se insertan y editan directamente. RLS solo permite tocar los propios y, en ingresos, solo los de `source` `manual` o `sale`. El borrado es `deleted_at = now()`.
- **`partner_transfers`:** entregas de dinero entre socios. Solo las edita quien entregó.

| RPC | Notas |
|---|---|
| `calculate_settlement(p_start date, p_end date, p_reserve_fund=0, p_declared_cash jsonb={})` | Devuelve `{total_income, box_expenses, reserve_fund, net_profit, partners[], transfers[], has_cash_differences}`. Ver detalle abajo. |
| `save_settlement(p_title?, p_start, p_end, p_reserve_fund, p_declared_cash, p_notes?)` | Guarda una foto inmutable del cuadre. |
| `set_settlement_transfer_paid(p_settlement_id, p_index, p_paid)` | Marca o desmarca un pago. Entre socios crea o anula un `partner_transfers` asociado al cuadre, que no afecta cuadres futuros. |
| `delete_settlement(p_settlement_id)` | Borrado lógico. |

Detalle de `calculate_settlement`:
- `p_declared_cash` es un objeto `{"<partner_id>": monto}`.
- Cada socio en `partners[]` trae: `income_collected`, `box_expenses_paid`, `personal_expenses`, `transfers_given`, `transfers_received`, `expected_cash`, `declared_cash`, `cash_difference`, `gross_share` y `net_balance`.
- Cada elemento de `transfers[]` trae: `from_partner_id`, `from_name`, `to_partner_id`, `to_name`, `to_reserve`, `amount` y `paid_at`.

`settlement_list` incluye `modified_after = true` si algún movimiento del periodo cambió después de guardar el cuadre.

## Bridge (solo el rol `bridge`)

| RPC | Notas |
|---|---|
| `claim_next_access_command()` | Toma el comando pendiente más antiguo (`skip locked`). Devuelve una fila con `id` nulo si no hay. |
| `complete_access_command(p_command_id, p_ok, p_error?, p_hik_person_id?)` | Con `p_ok`, registra el estado confirmado en HCAC (`hik_*`). Si falla, reintenta hasta 5 veces y luego queda `failed`, con aviso a los socios. |
| `bridge_heartbeat(p_agent_version?, p_hik_version?, p_persons_count?, p_error?)` | Señal de vida. |
| `bridge_sync_persons(p_persons jsonb, p_full_snapshot=true)` | Recibe un arreglo de `{hik_person_id, person_code, full_name, phone, valid_from, valid_until, access_enabled}`. Devuelve `{created, adopted, extended, changed, skipped, deactivated}`. |

Payloads de los comandos que entrega `claim_next_access_command`:

| `command` | `payload` |
|---|---|
| `upsert_person` | `{person_code, full_name, phone, valid_from, valid_until, enabled}` |
| `set_validity` | `{valid_from, valid_until}` |
| `enable` / `disable` | `{}` |
