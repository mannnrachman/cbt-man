import { useCallback, useState, type ReactNode } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

export type ConfirmDialogRequest = {
	title: string;
	description: string;
	confirmLabel?: string;
	cancelLabel?: string;
	destructive?: boolean;
};

type PendingRequest = ConfirmDialogRequest & {
	resolve: (confirmed: boolean) => void;
};

export function ConfirmDialog(props: {
	open: boolean;
	title: string;
	description: string;
	confirmLabel?: string;
	cancelLabel?: string;
	destructive?: boolean;
	icon?: ReactNode;
	busy?: boolean;
	onOpenChange: (open: boolean) => void;
	onConfirm: () => void | Promise<void>;
}) {
	const {
		open,
		title,
		description,
		confirmLabel = "Lanjutkan",
		cancelLabel = "Batal",
		destructive = true,
	icon,
	busy = false,
		onOpenChange,
		onConfirm,
	} = props;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
				<DialogTitle className={`flex items-center gap-2 ${destructive ? "text-rose-600" : "text-foreground"}`}>
					{icon ?? <Trash2 className="h-5 w-5" />}
					{title}
				</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>
				<DialogFooter className="mt-4">
					<Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)} aria-label="Batal">
						{cancelLabel}
					</Button>
					<Button
						type="button"
						variant={destructive ? "destructive" : "default"}
						disabled={busy}
						onClick={onConfirm}
						aria-label={confirmLabel}
					>
						{confirmLabel}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

// eslint-disable-next-line react-refresh/only-export-components -- hook stays next to the dialog
export function useConfirmDialog(): {
	confirm: (request: ConfirmDialogRequest) => Promise<boolean>;
	dialog: ReactNode;
} {
	const [pending, setPending] = useState<PendingRequest | null>(null);

	const confirm = useCallback((request: ConfirmDialogRequest) => {
		return new Promise<boolean>((resolve) => {
			setPending({ ...request, resolve });
		});
	}, []);

	const close = useCallback(
		(confirmed: boolean) => {
			pending?.resolve(confirmed);
			setPending(null);
		},
		[pending],
	);

	const dialog = (
		<ConfirmDialog
			open={pending !== null}
			title={pending?.title ?? ""}
			description={pending?.description ?? ""}
			confirmLabel={pending?.confirmLabel}
			cancelLabel={pending?.cancelLabel}
			destructive={pending?.destructive}
			onOpenChange={(open) => {
				if (!open) close(false);
			}}
			onConfirm={() => close(true)}
		/>
	);

	return { confirm, dialog };
}
