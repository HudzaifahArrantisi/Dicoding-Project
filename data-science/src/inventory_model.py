from __future__ import annotations

from dataclasses import asdict, dataclass
import json
import math


LEAD_TIME_DAYS = 6


@dataclass(frozen=True)
class InventoryInput:
    sku: str
    product_name: str
    current_stock: int
    average_daily_usage: float
    maximum_daily_usage: float


@dataclass(frozen=True)
class InventoryRecommendation:
    sku: str
    product_name: str
    lead_time_days: int
    safety_stock: int
    reorder_point: int
    suggested_restock: int


def calculate_recommendation(
    item: InventoryInput,
    lead_time_days: int = LEAD_TIME_DAYS,
) -> InventoryRecommendation:
    average_lead_demand = item.average_daily_usage * lead_time_days
    maximum_lead_demand = item.maximum_daily_usage * lead_time_days
    safety_stock = math.ceil(max(0, maximum_lead_demand - average_lead_demand))
    reorder_point = math.ceil(average_lead_demand + safety_stock)
    target_stock = math.ceil(reorder_point + average_lead_demand)
    suggested_restock = max(0, target_stock - item.current_stock)

    return InventoryRecommendation(
        sku=item.sku,
        product_name=item.product_name,
        lead_time_days=lead_time_days,
        safety_stock=safety_stock,
        reorder_point=reorder_point,
        suggested_restock=suggested_restock,
    )


def main() -> None:
    products = [
        InventoryInput("DSK-SB-001", "Seblak Jadul Instan", 10, 4.0, 5.0),
        InventoryInput("DSK-BR-002", "Basreng Daun Jeruk", 10, 3.5, 5.0),
        InventoryInput("DSK-MK-003", "Makaroni Daun Jeruk", 30, 2.5, 4.0),
        InventoryInput("DSK-KP-004", "Keripik Pisang Rasa Coklat", 35, 2.0, 3.0),
    ]
    recommendations = [calculate_recommendation(item) for item in products]
    print(json.dumps([asdict(item) for item in recommendations], indent=2))


if __name__ == "__main__":
    main()
