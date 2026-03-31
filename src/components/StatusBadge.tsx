const colors: Record<string, string> = {
	pending: 'bg-yellow-900 text-yellow-300',
	confirmed: 'bg-green-900 text-green-300',
	expired: 'bg-red-900 text-red-300',
	requested: 'bg-yellow-900 text-yellow-300',
	approved: 'bg-blue-900 text-blue-300',
	processing: 'bg-blue-900 text-blue-300',
	signed: 'bg-blue-900 text-blue-300',
	cancelled: 'bg-red-900 text-red-300',
};

export function StatusBadge({ status }: { status: string }) {
	return (
		<span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[status] ?? 'bg-gray-700 text-gray-300'}`}>
			{status}
		</span>
	);
}
