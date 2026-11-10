from django.contrib import admin

from .models import (
    Shipment,
    ShipmentDocument,
    ShipmentEvent,
    ShipmentPlan,
    ShipmentRevision,
)

admin.site.register(Shipment)
admin.site.register(ShipmentRevision)
admin.site.register(ShipmentDocument)
admin.site.register(ShipmentPlan)
admin.site.register(ShipmentEvent)
