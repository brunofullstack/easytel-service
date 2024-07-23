import React, { useState, useEffect, useContext } from "react";
import { useParams, useHistory } from "react-router-dom";

import { toast } from "react-toastify";
import clsx from "clsx";

import { Paper, makeStyles, TextField, Button } from "@material-ui/core";

import ContactDrawer from "../ContactDrawer";
import MessageInput from "../MessageInputCustom/";
import TicketHeader from "../TicketHeader";
import TicketInfo from "../TicketInfo";
import TicketActionButtons from "../TicketActionButtonsCustom";
import MessagesList from "../MessagesList";
import api from "../../services/api";
import { ReplyMessageProvider } from "../../context/ReplyingMessage/ReplyingMessageContext";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import { TagsContainer } from "../TagsContainer";
import { socketConnection } from "../../services/socket";

const drawerWidth = 320;

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    height: "100%",
    position: "relative",
    overflow: "hidden",
  },

  mainWrapper: {
    flex: 1,
    height: "100%",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    borderLeft: "0",
    marginRight: -drawerWidth,
    transition: theme.transitions.create("margin", {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
  },

  mainWrapperShift: {
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    transition: theme.transitions.create("margin", {
      easing: theme.transitions.easing.easeOut,
      duration: theme.transitions.duration.enteringScreen,
    }),
    marginRight: 0,
  },
}));

const Ticket = () => {
  const { ticketId } = useParams();
  const history = useHistory();
  const classes = useStyles();

  const { user } = useContext(AuthContext);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [contact, setContact] = useState({});
  const [ticket, setTicket] = useState({});
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [boletoInfo, setBoletoInfo] = useState(null);

  useEffect(() => {
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      const fetchTicket = async () => {
        try {
          const { data } = await api.get("/tickets/u/" + ticketId);
          const { queueId, status } = data;
          const { queues, profile } = user;

          const queueAllowed = queues.find((q) => q.id === queueId);
          if (!queueAllowed && !['closed', 'campaign'].includes(status)  && profile !== "admin") {
            toast.error("Acesso não permitido");
            history.push("/tickets");
            return;
          }

          setContact(data.contact);
          setTicket(data);
          setLoading(false);
        } catch (err) {
          setLoading(false);
          toastError(err);
        }
      };
      fetchTicket();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [ticketId, user, history]);

  useEffect(() => {
    const companyId = localStorage.getItem("companyId");
    const socket = socketConnection({ companyId });

    socket.on("connect", () => socket.emit("joinChatBox", `${ticket.id}`));

    socket.on(`company-${companyId}-ticket`, (data) => {
      if (data.action === "update") {
        setTicket(data.ticket);
      }

      if (data.action === "delete") {
        toast.success("Ticket deletado com sucesso!");
        history.push("/tickets");
      }
    });

    socket.on(`company-${companyId}-contact`, (data) => {
      if (data.action === "update") {
        setContact((prevState) => {
          if (prevState.id === data.contact?.id) {
            return { ...prevState, ...data.contact };
          }
          return prevState;
        });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [ticketId, ticket, history]);

  const handleDrawerOpen = () => {
    setDrawerOpen(true);
  };

  const handleDrawerClose = () => {
    setDrawerOpen(false);
  };

  const handleCpfCnpjChange = (e) => {
    setCpfCnpj(e.target.value);
  };

  const handleCpfCnpjSubmit = async () => {
    try {
      const token = process.env.BEMTIVI_API_TOKEN; // Coloque aqui o seu token fixo

      const response = await fetch(`https://api-bemtevi.ksys.net.br/cliente?cpfcnpj=${cpfCnpj}`, {
        headers: {
          token: token
        }
      });

      const data = await response.json();

      if (data.data && data.data.length > 0) {
        const { cod_cliente, cpfcnpj } = data.data[0];

        const secondResponse = await fetch("https://api-bemtevi.ksys.net.br/cobranca/segundaVia", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            token: token
          },
          body: JSON.stringify({
            codcobranca: 2,
            codcliente: cod_cliente
          })
        });

        const secondData = await secondResponse.json();
        setBoletoInfo(secondData);
      } else {
        toast.error("Cliente não encontrado");
      }
    } catch (error) {
      toastError(error);
    }
  };

  const renderTicketInfo = () => {
    if (ticket.user !== undefined) {
      return (
        <TicketInfo
          contact={contact}
          ticket={ticket}
          onClick={handleDrawerOpen}
        />
      );
    }
  };

  const renderMessagesList = () => {
    return (
      <>
        <MessagesList
          ticket={ticket}
          ticketId={ticket.id}
          isGroup={ticket.isGroup}
        ></MessagesList>
        {ticket.status !== "closed" && <MessageInput ticketId={ticket.id} ticketStatus={ticket.status} />}
      </>
    );
  };

  return (
    <div className={classes.root} id="drawer-container">
      <Paper
        variant="outlined"
        elevation={0}
        className={clsx(classes.mainWrapper, {
          [classes.mainWrapperShift]: drawerOpen,
        })}
      >
        <TicketHeader loading={loading}>
          {renderTicketInfo()}
          <TicketActionButtons ticket={ticket} />
        </TicketHeader>
        <Paper>
          <TagsContainer ticket={ticket} />
        </Paper>
        <ReplyMessageProvider>{renderMessagesList()}</ReplyMessageProvider>
        <div>
          <TextField
            label="CPF/CNPJ"
            value={cpfCnpj}
            onChange={handleCpfCnpjChange}
          />
          <Button onClick={handleCpfCnpjSubmit}>Consultar</Button>
        </div>
        {boletoInfo && (
          <div>
            <p>Mensagem: {boletoInfo.msg}</p>
            <p>Link do PDF: <a href={boletoInfo.caminho_pdf} target="_blank" rel="noopener noreferrer">{boletoInfo.caminho_pdf}</a></p>
            <p>Código de Barras: {boletoInfo.cod_barras}</p>
          </div>
        )}
      </Paper>
      <ContactDrawer
        open={drawerOpen}
        handleDrawerClose={handleDrawerClose}
        contact={contact}
        loading={loading}
        ticket={ticket}
      />
    </div>
  );
};

export default Ticket;
