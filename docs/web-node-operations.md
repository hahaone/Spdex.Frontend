# Web Node Operations

## Response Headers

Each Web node adds these response headers at its local Nginx layer:

```http
X-SPdex-Web-Node: 1
X-SPdex-Web-Release: <git-sha>
```

`X-SPdex-Web-Node` comes from `web_node_id` in the Ansible inventory. If it is omitted, it is derived from the inventory host name, for example `web1` becomes `1`.

`X-SPdex-Web-Release` is injected by GitHub Actions from the current commit SHA. The verify playbook checks these headers on every Web node after deployment.

## Add A New Web Node

1. Create the ECS instance in the same VPC as the ALB backend group.
2. Use the standard Web image or run the Ansible bootstrap playbook so Docker, Docker Compose, Nginx, and the deployment directory exist.
3. Add the ECS private IP to the ALB backend server group on port `80`.
4. Add one line to the `WEB_ANSIBLE_INVENTORY` GitHub secret:

```ini
web3 ansible_host=10.111.x.x web_node_id=3 ansible_user=root ansible_ssh_private_key_file=~/.ssh/id_rsa ansible_ssh_common_args='-F ~/.ssh/config'
```

5. Run the frontend deploy workflow once. Use `release_scope=all` for the first release on a fresh node.

No per-release manual copy is required. GitHub Actions builds images once, Ansible deploys the same image references to every Web node, and the verify playbook checks every node before the run passes.

## Version Sync

The deployment version is the GitHub commit SHA. During an incremental deploy, changed services use the new SHA image while unchanged services keep their currently running image reference. During a full deploy, every frontend service receives the same new SHA.

For a new node, run a full deploy first so all services have a known image baseline. After that, incremental deploys remain safe because Ansible can inspect the existing images on that node.
