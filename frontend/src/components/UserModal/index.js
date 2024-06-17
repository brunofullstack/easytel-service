import React, { useState, useEffect, useContext } from "react";

import * as Yup from "yup";
import { Formik, Form, Field } from "formik";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import CircularProgress from "@material-ui/core/CircularProgress";
import Select from "@material-ui/core/Select";
import InputLabel from "@material-ui/core/InputLabel";
import MenuItem from "@material-ui/core/MenuItem";
import FormControl from "@material-ui/core/FormControl";

import { i18n } from "../../translate/i18n";
import { isArray } from "lodash";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import QueueSelect from "../QueueSelect";
import { AuthContext } from "../../context/Auth/AuthContext";
import { Can } from "../Can";
import { Switch, FormControlLabel, ListSubheader } from "@material-ui/core";
import WhatsappSelect from "../WhatsappSelect";

const useStyles = makeStyles(theme => ({
	root: {
		display: "flex",
		flexWrap: "wrap",
	},
	multFieldLine: {
		display: "flex",
		"& > *:not(:last-child)": {
			marginRight: theme.spacing(1),
		},
	},

	btnWrapper: {
		position: "relative",
	},

	buttonProgress: {
		color: green[500],
		position: "absolute",
		top: "50%",
		left: "50%",
		marginTop: -12,
		marginLeft: -12,
	},
	formControl: {
		margin: theme.spacing(1),
		minWidth: 120,
	},
}));

const UserSchema = Yup.object().shape({
	name: Yup.string()
		.min(2, "Too Short!")
		.max(50, "Too Long!")
		.required("Required"),
	password: Yup.string().min(5, "Too Short!").max(50, "Too Long!"),
	email: Yup.string().email("Invalid email").required("Required"),
	maxCampaigns: Yup.number(),
	maxContactsPerCampaign: Yup.number(),
});

const UserModal = ({ open, onClose, userId }) => {
	const classes = useStyles();

	const initialState = {
		name: "",
		email: "",
		password: "",
		profile: "user",
	};

	const { user: loggedInUser } = useContext(AuthContext);

	const [user, setUser] = useState(initialState);
	const [campaignsEnabled, setCampaignEnabled] = useState(false);
	const [campaignsEnabledInCompany, setCampaignEnabledInCompany] = useState(false);
	const [selectedQueueIds, setSelectedQueueIds] = useState([]);
	const [selectedWhatsappIds, setSelectedWhatsappIds] = useState([]);

	useEffect(() => {
		const fetchUser = async () => {
			if (!userId) return;
			try {
				const { data } = await api.get(`/users/${userId}`);
				setUser(prevState => {
					return { ...prevState, ...data };
				});
				const userQueueIds = data.queues?.map(queue => queue.id);
				const userWhatsappIds = data.whatsapps?.map(w => w.id);
				setSelectedQueueIds(userQueueIds);
				setSelectedWhatsappIds(userWhatsappIds);
			} catch (err) {
				toastError(err);
			}
		};

		fetchUser();
	}, [userId, open]);

	useEffect(() => {
		const fetchCampaignConfig = async () => {
			if (!userId) return;
			try {
				const { data } = await api.get(`/settings/byUser/${userId}`);
        let keyValueCompany = {};
        let keyValueUser = {};
        if (isArray(data?.company)) {
          keyValueCompany = Object.assign({}, ...data.company.map((x) => ({[x.key]: x.value})));
        }

        if (isArray(data?.user)) {
          keyValueUser = Object.assign({}, ...data.user.map((x) => ({[x.key]: x.value})));
        }

				const isCampaignEnabledInCompany =  keyValueCompany["campaignsEnabled"]?.toLowerCase() === 'true';
				setCampaignEnabledInCompany(isCampaignEnabledInCompany);
				const isCampaignEnabled = isCampaignEnabledInCompany
          && keyValueUser["campaignsEnabled"]?.toLowerCase() === 'true'
          ? true
          : false;
				setCampaignEnabled(isCampaignEnabled);
				setUser(prevState => {
					return { ...prevState, ...{
						maxCampaigns: keyValueUser["maxCampaigns"],
						maxContactsPerCampaign: keyValueUser["maxContactsPerCampaign"]
					}};
				})
			} catch (err) {
				toastError(err);
			}
		};

		fetchCampaignConfig();
	}, [userId, open]);

	const handleClose = () => {
		onClose();
		setUser(initialState);
	};

	const handleSaveUser = async values => {
		const userData = { ...values, queueIds: selectedQueueIds, whatsappIds: selectedWhatsappIds };
		const maxCampaigns = userData.maxCampaigns;
		const maxContactsPerCampaign = userData.maxContactsPerCampaign;
		delete userData.maxCampaigns;
		delete userData.maxContactsPerCampaign;
		try {
			if (userId) {
				await api.put(`/users/${userId}`, userData);
			} else {
				await api.post("/users", userData);
			}
			toast.success(i18n.t("userModal.success"));
		} catch (err) {
			toastError(err);
		}

		try {
			if (userId) {
				const settings = {
					campaignsEnabled: false,
				};
				settings.campaignsEnabled = campaignsEnabled;
				settings.maxCampaigns = maxCampaigns;
				settings.maxContactsPerCampaign = maxContactsPerCampaign;
				await api.put(`/settings/byUser/${userId}`, settings);
			}
		} catch (error) {
			toastError(error);
		}

		handleClose();
	};

	const notSameUser = loggedInUser.id !== user.id;
	const canEditCampaigns = !notSameUser ? true : (loggedInUser.profile === "admin" && user.profile !== "admin");

	return (
		<div className={classes.root}>
			<Dialog
				open={open}
				onClose={handleClose}
				maxWidth="xs"
				fullWidth
				scroll="paper"
			>
				<DialogTitle id="form-dialog-title">
					{userId
						? `${i18n.t("userModal.title.edit")}`
						: `${i18n.t("userModal.title.add")}`}
				</DialogTitle>
				<Formik
					initialValues={user}
					enableReinitialize={true}
					validationSchema={UserSchema}
					onSubmit={(values, actions) => {
						setTimeout(() => {
							handleSaveUser(values);
							actions.setSubmitting(false);
						}, 400);
					}}
				>
					{({ touched, errors, isSubmitting }) => (
						<Form>
							<DialogContent dividers>
								<div className={classes.multFieldLine}>
									<Field
										as={TextField}
										label={i18n.t("userModal.form.name")}
										autoFocus
										name="name"
										error={touched.name && Boolean(errors.name)}
										helperText={touched.name && errors.name}
										variant="outlined"
										margin="dense"
										fullWidth
									/>
									<Field
										as={TextField}
										label={i18n.t("userModal.form.password")}
										type="password"
										name="password"
										error={touched.password && Boolean(errors.password)}
										helperText={touched.password && errors.password}
										variant="outlined"
										margin="dense"
										fullWidth
									/>
								</div>
								<div className={classes.multFieldLine}>
									<Field
										as={TextField}
										label={i18n.t("userModal.form.email")}
										name="email"
										error={touched.email && Boolean(errors.email)}
										helperText={touched.email && errors.email}
										variant="outlined"
										margin="dense"
										fullWidth
									/>
									<FormControl
										variant="outlined"
										className={classes.formControl}
										margin="dense"
									>
										<Can
											role={loggedInUser.profile}
											perform="user-modal:editProfile"
											yes={() => (
												<>
													<InputLabel id="profile-selection-input-label">
														{i18n.t("userModal.form.profile")}
													</InputLabel>

													<Field
														as={Select}
														label={i18n.t("userModal.form.profile")}
														name="profile"
														labelId="profile-selection-label"
														id="profile-selection"
														required
													>
														<MenuItem value="admin">Admin</MenuItem>
														<MenuItem value="user">User</MenuItem>
													</Field>
												</>
											)}
										/>
									</FormControl>
								</div>
								<Can
									role={loggedInUser.profile}
									perform="user-modal:editQueues"
									yes={() => (
										<QueueSelect
											selectedQueueIds={selectedQueueIds}
											onChange={values => setSelectedQueueIds(values)}
										/>
									)}
								/>
								<WhatsappSelect
									selectedWhatsappIds={selectedWhatsappIds}
									onChange={values => setSelectedWhatsappIds(values)}
								/>
								{campaignsEnabledInCompany &&
									<React.Fragment>
										<ListSubheader>
											{i18n.t("mainDrawer.listItems.campaigns")}
										</ListSubheader>
                    <FormControl
                      variant="outlined"
                      margin="dense"
                      fullWidth
                    >
                      <InputLabel id="confirmation-selection-label">
                        {i18n.t("userModal.form.campaignEnable")}
                      </InputLabel>
                      <Field
                        as={Select}
                        label={i18n.t("userModal.form.campaignEnable")}
                        placeholder={i18n.t(
                          "userModal.form.campaignEnable"
                        )}
                        labelId="campaignEnable-selection-label"
                        id="campaignEnable-selection"
                        name="campaignsEnable"
												value={campaignsEnabled}
												onChange={(e) => setCampaignEnabled(e.target.value)}
                        error={
                          touched.confirmation && Boolean(errors.confirmation)
                        }
                        disabled={!canEditCampaigns}
                      >
                        <MenuItem value={false}>Desabilitada</MenuItem>
                        <MenuItem value={true}>Habilitada</MenuItem>
                      </Field>
                    </FormControl>
										<div className={classes.multFieldLine}>
											<Field
												as={TextField}
												label={i18n.t("userModal.form.maxCampaigns")}
												type="maxCampaigns"
												name="maxCampaigns"
												error={touched.maxCampaigns && Boolean(errors.maxCampaigns)}
												helperText={touched.maxCampaigns && Boolean(errors.maxCampaigns) && i18n.t("form.errors.number")}
												variant="outlined"
												margin="dense"
												disabled={!campaignsEnabled || !canEditCampaigns}
												fullWidth
											/>
											<Field
												as={TextField}
												label={i18n.t("userModal.form.maxContactsPerCampaign")}
												type="maxContactsPerCampaign"
												name="maxContactsPerCampaign"
												error={touched.maxContactsPerCampaign && Boolean(errors.maxContactsPerCampaign)}
												helperText={touched.maxContactsPerCampaign && Boolean(errors.maxContactsPerCampaign) && i18n.t("form.errors.number")}
												disabled={!campaignsEnabled || !canEditCampaigns}
												variant="outlined"
												margin="dense"
												fullWidth
											/>
										</div>
									</React.Fragment>
								}
							</DialogContent>
							<DialogActions>
								<Button
									onClick={handleClose}
									color="secondary"
									disabled={isSubmitting}
									variant="outlined"
								>
									{i18n.t("userModal.buttons.cancel")}
								</Button>
								<Button
									type="submit"
									color="primary"
									disabled={isSubmitting}
									variant="contained"
									className={classes.btnWrapper}
								>
									{userId
										? `${i18n.t("userModal.buttons.okEdit")}`
										: `${i18n.t("userModal.buttons.okAdd")}`}
									{isSubmitting && (
										<CircularProgress
											size={24}
											className={classes.buttonProgress}
										/>
									)}
								</Button>
							</DialogActions>
						</Form>
					)}
				</Formik>
			</Dialog>
		</div>
	);
};

export default UserModal;
