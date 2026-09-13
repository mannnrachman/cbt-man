import { useCallback, useState, type ReactNode } from "react";
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
	onOpenChange: (open: boolean) => void;
	onConfirm: () => void;
}) {
	const {
		open,
		title,
		description,
		confirmLabel = "Lanjutkan",
		cancelLabel = "Batal",
		destructive = true,
		onOpenChange,
		onConfirm,
	} = props;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>
				<DialogFooter className="mt-4">
					<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
						{cancelLabel}
					</Button>
					<Button
						type="button"
						variant={destructive ? "destructive" : "default"}
						onClick={onConfirm}
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
