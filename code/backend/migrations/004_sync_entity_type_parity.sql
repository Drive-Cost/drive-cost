ALTER TABLE sync_entities
  DROP CONSTRAINT sync_entities_entity_type_check,
  ADD CONSTRAINT sync_entities_entity_type_check
    CHECK (entity_type IN (
      'vehicle',
      'fuel_entry',
      'charging_entry',
      'maintenance_entry',
      'expense_entry',
      'recurring_expense'
    ));

ALTER TABLE sync_changes
  DROP CONSTRAINT sync_changes_entity_type_check,
  ADD CONSTRAINT sync_changes_entity_type_check
    CHECK (entity_type IN (
      'vehicle',
      'fuel_entry',
      'charging_entry',
      'maintenance_entry',
      'expense_entry',
      'recurring_expense'
    ));
