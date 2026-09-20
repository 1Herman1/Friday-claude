-- Свой курьер как отдельный способ доставки: до этого витрина записывала его как cdek.
ALTER TYPE "DeliveryMethod" ADD VALUE IF NOT EXISTS 'simba_courier';
