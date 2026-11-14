from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone


class FinanceProfile(models.Model):
    owner = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="finance_profile")
    use_sample_data = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Finanzas de {self.owner_id}"


class FinanceAccount(models.Model):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="finance_accounts")
    name = models.CharField(max_length=120)
    account_type = models.CharField(max_length=80)
    description = models.CharField(max_length=160, blank=True)
    status = models.CharField(max_length=40, default="Activa")
    badge = models.CharField(max_length=40, blank=True)
    icon = models.CharField(max_length=24, default="credit")
    balance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["id"]
        constraints = [models.UniqueConstraint(fields=["owner", "name"], name="unique_finance_account_per_owner")]

    def __str__(self):
        return f"{self.name} ({self.owner_id})"


class FinanceTransaction(models.Model):
    class Type(models.TextChoices):
        INCOME = "INGRESO", "Ingreso"
        EXPENSE = "GASTO", "Gasto"

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="finance_transactions")
    account = models.ForeignKey(FinanceAccount, null=True, blank=True, on_delete=models.SET_NULL, related_name="transactions")
    account_label = models.CharField(max_length=120, blank=True)
    name = models.CharField(max_length=160)
    category = models.CharField(max_length=80)
    transaction_type = models.CharField(max_length=8, choices=Type.choices)
    amount = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(0.01)])
    status = models.CharField(max_length=40, default="Completado")
    count_in_summary = models.BooleanField(default=True)
    occurred_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-occurred_at", "-id"]

    def __str__(self):
        return f"{self.name} ({self.amount})"


class FinanceBudget(models.Model):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="finance_budgets")
    month = models.CharField(max_length=7, default="2024-05")
    category = models.CharField(max_length=80)
    description = models.CharField(max_length=180, blank=True)
    limit_amount = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(0.01)])
    spent_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    projected_amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    color = models.CharField(max_length=16, default="green")
    icon = models.CharField(max_length=24, default="shopping")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["id"]
        constraints = [models.UniqueConstraint(fields=["owner", "category", "month"], name="unique_finance_budget_per_month")]

    def __str__(self):
        return f"{self.category} ({self.owner_id})"


class FinanceAlert(models.Model):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="finance_alerts")
    category = models.CharField(max_length=80, blank=True)
    title = models.CharField(max_length=160)
    description = models.TextField()
    level = models.CharField(max_length=16, default="green")
    action_label = models.CharField(max_length=80, blank=True)
    percentage = models.FloatField(null=True, blank=True)
    is_read = models.BooleanField(default=False)
    dismissed = models.BooleanField(default=False)
    snoozed_until = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return self.title
