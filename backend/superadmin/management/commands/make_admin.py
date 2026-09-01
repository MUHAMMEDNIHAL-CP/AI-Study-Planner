from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

User = get_user_model()


class Command(BaseCommand):
    help = "Promote an existing user to super admin (is_superuser + is_staff)."

    def add_arguments(self, parser):
        parser.add_argument("email", help="Email of the user to promote.")

    def handle(self, *args, **options):
        email = options["email"].strip().lower()
        user = User.objects.filter(email__iexact=email).first()
        if not user:
            raise CommandError(f"No user found with email '{email}'.")

        if user.is_superuser:
            self.stdout.write(
                self.style.WARNING(f"'{email}' is already a superadmin.")
            )
            return

        user.is_superuser = True
        user.is_staff = True
        user.save(update_fields=["is_superuser", "is_staff"])
        self.stdout.write(
            self.style.SUCCESS(f"Promoted '{email}' to super admin (id={user.id}).")
        )